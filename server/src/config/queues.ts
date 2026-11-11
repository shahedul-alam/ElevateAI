import { Queue, Worker } from 'bullmq'
import { closeSummaryQueue, startSummaryWorker } from '../modules/applications/applicant-summary.queue'
import { pruneNotifications } from '../modules/notifications/notifications.service'
import { redis } from './redis'

const SIX_HOURS = 6 * 60 * 60 * 1000
const maintenance = new Queue('maintenance', { connection: redis, defaultJobOptions: { removeOnComplete: true, removeOnFail: 20 } })
const workers: Worker[] = []

export async function startWorkers() {
  workers.push(startSummaryWorker())
  workers.push(
    new Worker(
      'maintenance',
      async () => {
        const count = await pruneNotifications()
        if (count > 0) console.log(`Expired ${count} notification(s)`)
      },
      { connection: redis },
    ),
  )
  for (const w of workers) w.on('failed', (job, err) => console.error(`Job ${w.name}/${job?.id} failed:`, err))
  // Fixed scheduler id: every instance upserts the same schedule, so it runs once per interval cluster-wide.
  // One prune right now too (the fixed job id collapses concurrent boots into one).
  await maintenance.upsertJobScheduler('prune-notifications', { every: SIX_HOURS }, { name: 'prune' })
  await maintenance.add('prune', {}, { jobId: 'prune-boot' }).catch(() => {})
}

export async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close()))
  await Promise.all([maintenance.close(), closeSummaryQueue()])
  redis.disconnect()
}
