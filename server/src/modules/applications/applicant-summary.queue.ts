import { Queue, Worker } from 'bullmq'
import { redis } from '../../config/redis'
import { LAZY_BATCH } from './applicant-summary.config'
import { ensureSummary } from './applicant-summary.service'

const NAME = 'summary'
const queue = new Queue(NAME, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
})

/** Queues one summary. The job id dedupes while a job for the same application is waiting or running. */
export function enqueueSummary(applicationId: string) {
  // A Redis failure must never fail an apply or an employer list.
  queue.add('summarize', { applicationId }, { jobId: `summary-${applicationId}` }).catch((err) => {
    console.error('Could not queue applicant summary:', applicationId, err)
  })
}

/** Lazy path for employer lists: queues a few missing summaries, never waits for them. */
export function enqueueSummaries(applicationIds: string[]) {
  for (const id of applicationIds.slice(0, LAZY_BATCH)) enqueueSummary(id)
}

export const startSummaryWorker = () =>
  new Worker(NAME, (job) => ensureSummary(job.data.applicationId), { connection: redis, concurrency: 3 })

export const closeSummaryQueue = () => queue.close()
