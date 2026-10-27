import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
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
import { registerSchema, type RegisterInput, type Role } from '@/features/auth/auth.schema'
import { useAuthStore } from '@/features/auth/auth.store'
import { useRegister } from '@/features/auth/use-register'
import { SESSION_KEY } from '@/features/auth/use-session'
import { getApiError } from '@/lib/api'

const roles: { value: Role; label: string }[] = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'employer', label: 'Employer' },
]

const fields = ['name', 'email', 'password', 'role'] as const

export default function Register() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const { mutate, isPending } = useRegister()

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', role: 'candidate' },
  })

  const role = useWatch({ control, name: 'role' })
  const authStatus = useAuthStore((s) => s.status)

  if (authStatus === 'loading') return null
  if (authStatus === 'authenticated') return <Navigate to="/" replace />

  const onSubmit = (values: RegisterInput) => {
    mutate(values, {
      onSuccess: (user) => {
        setUser(user)
        queryClient.setQueryData(SESSION_KEY, user)
        toast.success('Account created', { description: `Welcome to ElevateAI, ${user.name}.` })
        navigate('/')
      },
      onError: (err) => {
        const { status, message, details } = getApiError(err)

        if (status === 409) {
          setError('email', { message })
          toast.error('Email already registered', { description: message })
          return
        }

        const matched = details.filter((d) => fields.includes(d.field as (typeof fields)[number]))
        for (const d of matched) setError(d.field as (typeof fields)[number], { message: d.message })

        toast.error(status === 429 ? 'Too many attempts' : 'Sign up failed', {
          description: status === 429 ? 'Please wait a minute and try again.' : message,
        })
      },
    })
  }

  return (
    <main className="mx-auto flex max-w-md justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Join ElevateAI as a candidate or employer.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>I am a</Label>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="Account type"
              >
                {roles.map((r) => (
                  <Button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={role === r.value}
                    variant={role === r.value ? 'default' : 'outline'}
                    onClick={() => setValue('role', r.value, { shouldValidate: true })}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
              <FieldError message={errors.role?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError message={errors.name?.message} />
            </div>
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
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password ? (
                <FieldError message={errors.password.message} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters, with a letter and a digit.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Creating account...' : 'Sign up'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-foreground underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
