import { Link } from 'react-router'

import { useAuthStore } from '@/features/auth/auth.store'

const YEAR = new Date().getFullYear()

const columns = (role?: string) => [
  {
    title: 'Candidates',
    links: [
      { label: 'Browse jobs', to: '/jobs' },
      { label: 'Companies', to: '/companies' },
      { label: 'Resume builder', to: role === 'candidate' ? '/resume' : '/register' },
    ],
  },
  {
    title: 'Employers',
    links: [
      { label: 'Post a job', to: role === 'employer' ? '/employer/jobs/new' : '/register' },
      ...(role ? [] : [{ label: 'Log in', to: '/login' }]),
    ],
  },
  { title: 'Legal', links: [{ label: 'AI privacy notice', to: '/privacy' }] },
]

export function SiteFooter() {
  const role = useAuthStore((s) => s.user?.role)
  return (
    <footer className="mt-8 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold">ElevateAI</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Transparent job matching for candidates, ranked shortlists for employers.
          </p>
        </div>
        {columns(role).map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-medium">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">
        © {YEAR} ElevateAI
      </p>
    </footer>
  )
}
