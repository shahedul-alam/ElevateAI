import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { FieldError } from '@/components/field-error'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginSchema, type LoginInput } from '@/features/auth/auth.schema'
import { useAuthStore } from '@/features/auth/auth.store'
import { useLogin } from '@/features/auth/use-login'
import { SESSION_KEY } from '@/features/auth/use-session'
import { getApiError } from '@/lib/api'

const fields = ['email', 'password'] as const

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const authStatus = useAuthStore((s) => s.status)
  const { mutate, isPending } = useLogin()

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (authStatus === 'loading') return null
  if (authStatus === 'authenticated') return <Navigate to="/" replace />

  const onSubmit = (values: LoginInput) => {
    mutate(values, {
      onSuccess: (user) => {
        setUser(user)
        queryClient.setQueryData(SESSION_KEY, user)
        toast.success('Signed in', { description: `Welcome back, ${user.name}.` })
        navigate('/')
      },
      onError: (err) => {
        const { status, message, details } = getApiError(err)

        if (status === 401) {
          // Generic on purpose: the server does not reveal whether the email or password was wrong.
          resetField('password')
          toast.error('Sign in failed', { description: message })
          return
        }

        const matched = details.filter((d) => fields.includes(d.field as (typeof fields)[number]))
        for (const d of matched) setError(d.field as (typeof fields)[number], { message: d.message })

        toast.error(status === 429 ? 'Too many attempts' : 'Sign in failed', {
          description: status === 429 ? 'Please wait a minute and try again.' : message,
        })
      },
    })
  }

  return (
    <main className="mx-auto flex max-w-md justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to ElevateAI.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <FieldError message={errors.password?.message} />
            </div>
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Signing in...' : 'Log in'}
            </Button>
            <p className="text-sm text-muted-foreground">
              No account?{' '}
              <Link to="/register" className="text-foreground underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
