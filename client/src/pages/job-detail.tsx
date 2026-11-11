import { Link, useParams } from 'react-router'

import { JobPostView } from '@/features/jobs/job-post-view'
import { usePublicJob } from '@/features/jobs/use-jobs'
import { MatchPanel } from '@/features/matching/match-panel'

export default function JobDetail() {
  const { id = '' } = useParams()
  const job = usePublicJob(id)

  if (job.isPending) return null
  if (job.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          This job is not available. <Link to="/jobs" className="underline">Browse all jobs</Link>
        </p>
      </main>
    )
  }

  const { content, termNames, employerName, company } = job.data

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/jobs" className="mb-4 inline-block text-sm text-muted-foreground underline">
        All jobs
      </Link>
      <JobPostView content={content} termNames={termNames} employerName={employerName} company={company}>
        <MatchPanel jobId={job.data.id} jobTitle={content.title} companyName={company?.name ?? employerName} />
      </JobPostView>
    </main>
  )
}
