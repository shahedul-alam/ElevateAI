import { Link } from 'react-router'

const features = [
  ['Resume import', 'The PDF or DOCX file you upload. Contact details in it are not imported.'],
  ['Resume review', 'Your saved resume content: headline, summary, skills, roles, education and certifications.'],
  ['Job post assistant (employers)', 'The job description text you paste.'],
  ['Gap explanation', 'The job’s public requirements and your skills, levels and years, with your match numbers.'],
  [
    'Applicant summary',
    'The resume you applied with: skills, role titles and descriptions, degree and certifications. Your name, employers, schools, dates, contact details and photo are left out.',
  ],
] as const

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">AI privacy notice</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        How ElevateAI uses OpenAI in its AI features, in plain language.
      </p>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What is sent</h2>
        <p className="text-sm">
          When you use an AI feature, ElevateAI sends the text it needs to OpenAI, which returns the result. This
          happens only after you agree, the first time you use one.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {features.map(([name, what]) => (
            <li key={name}>
              <span className="font-medium">{name}:</span> {what}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What is never sent</h2>
        <p className="text-sm">
          Your phone number, email, links, photo, job preferences, and employers’ private notes and ratings are never
          sent to OpenAI.
        </p>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What is stored and who sees it</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Resume reviews and gap explanations are stored with your account and shown only to you.</li>
          <li>
            If you apply to a job and have agreed, an AI-written summary of the resume you applied with is stored on
            your application and shown to that employer. It describes your resume only; it is not a recommendation.
          </li>
          <li>Import results and job drafts only fill a form. Nothing is saved until you press Save.</li>
        </ul>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">AI does not decide about you</h2>
        <p className="text-sm">
          Your match score comes from a fixed calculation on what you entered, never from AI. AI does not rank, show
          or reject candidates.
        </p>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Withdrawing</h2>
        <p className="text-sm">
          You can withdraw your agreement at any time on your{' '}
          <Link to="/account" className="underline">
            account page
          </Link>
          . New AI requests, and new applicant summaries, stop immediately. Results already stored, including a summary
          already written on an application, are kept.
        </p>
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Questions</h2>
        <p className="text-sm text-muted-foreground">
          Contact the ElevateAI team about this notice. (Operator contact details to be added before launch.)
        </p>
      </section>
    </main>
  )
}
