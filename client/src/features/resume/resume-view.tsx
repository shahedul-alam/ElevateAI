import type { ReactNode } from 'react'

import { safeHref } from '@/lib/safe-href'
import { skillLabel, type ResumeModel } from './resume-model'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h2 className="mb-2 border-b border-neutral-400 pb-1 text-xs font-bold tracking-widest uppercase">{title}</h2>
      {children}
    </section>
  )
}

/**
 * The resume as a sheet of paper. It stays white with dark text in dark mode too, because that is
 * what the downloaded PDF looks like.
 */
export function ResumeSheet({ model }: { model: ResumeModel }) {
  return (
    <article
      aria-label="Resume"
      className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 text-sm leading-relaxed text-neutral-900 shadow-sm ring-1 ring-black/10 sm:p-10"
    >
      <header className="mb-5">
        <h1 className="text-2xl font-bold">{model.name}</h1>
        {model.headline && <p className="text-base">{model.headline}</p>}
        {model.contact.length > 0 && <p className="mt-1 text-neutral-700">{model.contact.join(' · ')}</p>}
        {model.links.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-4 text-neutral-700">
            {model.links.map((l) => (
              <li key={l.label}>
                {l.label}:{' '}
                <a
                  href={safeHref(l.url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline"
                >
                  {l.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      {model.summary && (
        <Section title="Summary">
          <p className="whitespace-pre-wrap">{model.summary}</p>
        </Section>
      )}

      {model.skills.length > 0 && (
        <Section title="Skills">
          <p>{model.skills.map(skillLabel).join(' · ')}</p>
        </Section>
      )}

      {model.experience.length > 0 && (
        <Section title="Experience">
          <ul className="flex flex-col gap-3">
            {model.experience.map((e, i) => (
              <li key={i}>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <p className="font-bold">{[e.title, e.company].filter(Boolean).join(', ')}</p>
                  <p className="text-neutral-700">{e.period}</p>
                </div>
                {e.domain && <p className="text-neutral-700">{e.domain}</p>}
                {e.description && <p className="mt-1 whitespace-pre-wrap">{e.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {model.education.length > 0 && (
        <Section title="Education">
          <ul className="flex flex-col gap-2">
            {model.education.map((e, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-4">
                <div>
                  <p className="font-bold">{e.heading}</p>
                  {e.institution && <p>{e.institution}</p>}
                </div>
                <p className="text-neutral-700">{e.period}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {model.certifications.length > 0 && (
        <Section title="Certifications">
          <ul className="list-disc pl-5">
            {model.certifications.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {model.additional.length > 0 && (
        <Section title="Additional">
          <ul className="flex flex-col gap-1">
            {model.additional.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  )
}
