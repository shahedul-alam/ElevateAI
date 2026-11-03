import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { signOutRequest } from '@/features/auth/auth.api'
import { useAuthStore } from '@/features/auth/auth.store'
import { SESSION_KEY } from '@/features/auth/use-session'
import { cn } from '@/lib/utils'

// /dashboard is a placeholder: that route does not exist yet.
const candidateLinks = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/companies', label: 'Companies' },
  { to: '/resume', label: 'Resume' },
  { to: '/applications', label: 'Applications' },
  { to: '/dashboard', label: 'Dashboard' },
]

// Employers have no resume; they manage their postings instead.
const employerLinks = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/companies', label: 'Companies' },
  { to: '/employer/jobs', label: 'Your jobs' },
  { to: '/employer/company', label: 'Company profile' },
  { to: '/dashboard', label: 'Dashboard' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-sm font-medium transition-colors hover:text-foreground',
    isActive ? 'text-foreground' : 'text-muted-foreground',
  )

function useSignOut() {
  const clearUser = useAuthStore((s) => s.clearUser)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    // Best effort: the local state is cleared even if the request fails, but only once it has settled,
    // so the /me refetch that follows cannot find the old session and resurrect the user.
    signOutRequest()
      .catch(() => {})
      .finally(() => {
        queryClient.removeQueries({ queryKey: SESSION_KEY })
        clearUser()
        navigate('/')
      })
  }
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const signOut = useSignOut()
  const links = user?.role === 'employer' ? employerLinks : candidateLinks

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          ElevateAI
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          {status === 'loading' ? (
            <div
              className="hidden h-9 w-40 animate-pulse rounded-lg bg-muted md:block"
              aria-hidden
            />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden md:inline-flex">
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.email} · {user.role}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={linkClass}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="flex flex-col gap-2 pt-2">
                  {status === 'loading' ? (
                    <div className="h-9 animate-pulse rounded-lg bg-muted" aria-hidden />
                  ) : user ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {user.name} · {user.role}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpen(false)
                          signOut()
                        }}
                      >
                        Sign out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" asChild>
                        <Link to="/login" onClick={() => setOpen(false)}>
                          Log in
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link to="/register" onClick={() => setOpen(false)}>
                          Sign up
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
