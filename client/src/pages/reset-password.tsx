import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
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
import { resetPasswordSchema, type ResetPasswordInput } from '@/features/auth/auth.schema'
import { useResetPassword } from '@/features/auth/use-reset-password'
import { getApiError } from '@/lib/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const linkInvalid = !token || params.has('error')
  const { mutate, isPending } = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  })

  const onSubmit = ({ newPassword }: ResetPasswordInput) => {
    mutate(
      { token: token!, newPassword },
      {
        onSuccess: () => {
          toast.success('Password updated', { description: 'Log in with your new password.' })
          navigate('/login', { replace: true })
        },
        onError: (err) => {
          const { message } = getApiError(err)
          toast.error('Could not reset password', { description: message })
        },
      },
    )
  }

  if (linkInvalid) {
    return (
      <main className="mx-auto flex max-w-md justify-center px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Link expired or invalid</CardTitle>
            <CardDescription>Reset links work once and expire after 1 hour.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/forgot-password" className="text-sm text-foreground underline">
              Request a new link
            </Link>
          </CardFooter>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-md justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>You will be signed out everywhere else.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register('newPassword')}
            />
            {errors.newPassword ? (
              <FieldError message={errors.newPassword.message} />
            ) : (
              <p className="text-xs text-muted-foreground">
                At least 8 characters, with a letter and a digit.
              </p>
            )}
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Saving...' : 'Update password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
