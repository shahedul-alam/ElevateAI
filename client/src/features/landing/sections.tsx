import { Link } from 'react-router'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth.store'
import { JobCard } from '@/features/jobs/job-card'
import { usePublicJobs } from '@/features/jobs/use-jobs'
import { ApplicantsMock } from './applicants-mock'
import { MatchCardMock } from './match-card-mock'
import { WEIGHTS } from './weights'
import { useLandingCta } from './use-landing-cta'

const wrap = 'mx-auto w-full max-w-6xl px-4'
const eyebrow = 'text-sm font-medium text-brand'
const h2 = 'mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl'

export function Hero() {
  const { primary, secondary, loading } = useLandingCta()
  return (
    <section className={`${wrap} grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]`}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <p className={eyebrow}>AI-assisted career platform</p>
        <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.05] tracking-tight text-balance">
          Know exactly how you fit the job, and what closes the gap.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          ElevateAI scores your resume against real openings with a transparent formula, shows where you fall short,
          and gives employers a ranked shortlist instead of a pile of PDFs.
        </p>
        <div className={`mt-8 flex flex-wrap gap-3 ${loading ? 'invisible' : ''}`}>
          <Button asChild size="lg" className="h-11 bg-brand px-6 text-brand-foreground hover:bg-brand/90">
            <Link to={primary.to}>{primary.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-6">
            <Link to={secondary.to}>{secondary.label}</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Same inputs, same score, every time.</p>
      </div>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">
        <MatchCardMock />
      </div>
    </section>
  )
}

const STEPS = [
  { title: 'Build your profile', body: 'Upload a PDF or DOCX and review what we extracted, or fill it in by hand. Every version is saved.', cta: 'Start your profile', to: '/resume', guest: '/register' },
  { title: 'See your match and gaps', body: 'Each job shows a score per dimension and what would raise it, with an AI note on how to close the gap.', cta: 'Browse jobs', to: '/jobs', guest: '/jobs' },
  { title: 'Apply and follow along', body: 'Your score is frozen when you apply. Track each stage and get notified when it moves.', cta: 'See applications', to: '/applications', guest: '/register' },
]

export function HowItWorks() {
  const role = useAuthStore((s) => s.user?.role)
  // Steps are candidate-facing: guests go to sign-up, other roles only keep the public link.
  const link = (s: (typeof STEPS)[number]) => (role === undefined ? s.guest : role === 'candidate' || s.to === '/jobs' ? s.to : null)
  return (
    <section className="border-y bg-muted/40">
      <div className={`${wrap} py-16 sm:py-20`}>
        <p className={eyebrow}>How it works</p>
        <h2 className={h2}>Job hunting is guesswork. Hiring is a pile of PDFs.</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
          Candidates apply without knowing why they get ignored. Employers read hundreds of resumes to find a few. Three
          steps fix both sides.
        </p>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative md:border-t md:pt-6">
              <span className="text-sm font-medium tabular-nums text-brand">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground text-pretty">{s.body}</p>
              {link(s) && (
                <Link to={link(s)!} className="mt-3 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline">
                  {role === undefined && s.guest === '/register' ? 'Create an account' : s.cta} →
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const AUDIENCES = [
  {
    who: 'For candidates',
    title: 'Stop guessing where you stand',
    points: [
      'Resume review with a 0-100 score, strengths, weaknesses and keyword tips',
      'Gap chart across skills, experience, domain, education, leadership and certifications',
      'Job recommendations ranked by your match',
      'Application tracker with a notification at every stage',
    ],
  },
  {
    who: 'For employers',
    title: 'Read the best applicants first',
    points: [
      'Applicants ranked by match score, with a short neutral summary of each',
      'Draft a job post from a pasted description, then edit before you publish',
      'Hiring pipeline from applied to hired, with ratings and private notes',
      'A company profile that candidates can browse',
    ],
  },
]

export function Audiences() {
  return (
    <section className={`${wrap} py-16 sm:py-24`}>
      <div className="grid gap-6 md:grid-cols-2">
        {AUDIENCES.map((a) => (
          <div key={a.who} className="rounded-2xl border p-6 sm:p-8">
            <p className={eyebrow}>{a.who}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{a.title}</h2>
            <ul className="mt-6 space-y-3">
              {a.points.map((p) => (
                <li key={p} className="flex gap-3 text-muted-foreground">
                  <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span className="text-pretty">{p}</span>
                </li>
              ))}
            </ul>
            {a.who === 'For employers' && <ApplicantsMock />}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Transparency() {
  return (
    <section className="border-y bg-muted/40">
      <div className={`${wrap} grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center`}>
        <div>
          <p className={eyebrow}>No black box</p>
          <h2 className={h2}>The score is arithmetic, not a vibe</h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            Six dimensions with fixed weights decide the match. AI never sets the number: it extracts your resume,
            drafts text and explains the result. Employers see the score you applied with, and it never changes
            afterwards.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            AI features are opt-in. Read the{' '}
            <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">
              AI privacy notice
            </Link>
            .
          </p>
        </div>
        <div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Weights: skills 35, experience 20, domain 15, education 10, leadership 10, certifications 10">
            {WEIGHTS.map((d) => (
              <span key={d.label} className="bg-brand" style={{ width: `${d.weight}%` }} />
            ))}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {WEIGHTS.map((d) => (
              <li key={d.label} className="flex items-center gap-2 border-b pb-2">
                <span className="flex-1">{d.label}</span>
                <span className="tabular-nums text-muted-foreground">{d.weight}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const NO_FILTERS = { q: '', workMode: '', employmentType: '', domainId: '' }

/** Latest public openings; renders nothing while loading, on error, or when there are none. */
export function LatestOpenings() {
  const { data } = usePublicJobs(NO_FILTERS)
  const page = data?.pages[0]
  const jobs = page?.jobs.slice(0, 3) ?? []
  if (!page || jobs.length === 0) return null
  return (
    <section className={`${wrap} pb-16 sm:pb-24`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={eyebrow}>Hiring now</p>
          <h2 className={h2}>Latest openings</h2>
        </div>
        <Link to="/jobs" className="shrink-0 text-sm font-medium text-brand underline-offset-4 hover:underline">
          View all jobs →
        </Link>
      </div>
      <ul className="mt-8 flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} names={page.termNames} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const FAQ = [
  { q: 'Do I need an account to look around?', a: 'No. Jobs and company pages are public. You need a candidate account to see your own match and gap, and to apply.' },
  { q: 'How is the match score calculated?', a: 'By a fixed formula over six weighted dimensions: skills, experience, domain, education, leadership and certifications. The same profile and job always give the same number, and AI never sets it.' },
  { q: 'What does the AI actually do?', a: 'It reads an uploaded resume into your profile, reviews your resume, explains how to close a gap, drafts job posts for employers and writes a short neutral summary of each applicant. You review everything before it is saved.' },
  { q: 'Is my data sent to an AI provider?', a: 'Only if you opt in. AI features ask for your agreement first, you can withdraw it any time on your account page, and results already stored are kept. The privacy notice has the details.' },
  { q: 'Can employers see everything on my profile?', a: 'Employers see the resume version you applied with and the contact details you chose to save, for jobs you applied to. Their ratings and notes stay private to them.' },
  { q: 'Will my score change after I apply?', a: 'No. The score, your resume version and the job version are frozen when you apply, so employers see exactly what you submitted.' },
]

export function Faq() {
  return (
    <section className={`${wrap} py-16 sm:py-24`}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className={eyebrow}>FAQ</p>
          <h2 className={h2}>Questions, answered</h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            More on how AI is used and what is stored is in the{' '}
            <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">
              privacy notice
            </Link>
            .
          </p>
        </div>
        <div className="divide-y border-y">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-2 max-w-prose text-muted-foreground text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  const { primary, secondary, loading } = useLandingCta()
  return (
    <section className={`${wrap} pb-16 sm:pb-24`}>
      <div className="rounded-2xl bg-brand px-6 py-12 text-brand-foreground sm:px-12">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Find out how you match in a few minutes.
        </h2>
        <div className={`mt-8 flex flex-wrap gap-3 ${loading ? 'invisible' : ''}`}>
          <Button
            asChild
            size="lg"
            className="h-11 bg-brand-foreground px-6 text-brand hover:bg-brand-foreground/90"
          >
            <Link to={primary.to}>{primary.label}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-11 border-brand-foreground/60 bg-transparent px-6 text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground dark:border-brand-foreground/60 dark:bg-transparent dark:hover:bg-brand-foreground/15"
          >
            <Link to={secondary.to}>{secondary.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
