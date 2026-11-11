import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
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
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/features/auth/auth.schema'
import { useForgotPassword } from '@/features/auth/use-forgot-password'
import { getApiError } from '@/lib/api'

export default function ForgotPassword() {
  const { mutate, isPending, isSuccess } = useForgotPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = ({ email }: ForgotPasswordInput) => {
    mutate(email, {
      onError: (err) => {
        const { status, message } = getApiError(err)
        toast.error(status === 429 ? 'Too many attempts' : 'Could not send the link', {
          description: status === 429 ? 'Please wait a minute and try again.' : message,
        })
      },
    })
  }

  return (
    <main className="mx-auto flex max-w-md justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            {isSuccess
              ? 'If an account exists for that email, a reset link is on its way. It is valid for 1 hour.'
              : 'Enter your email and we will send you a link to choose a new password.'}
          </CardDescription>
        </CardHeader>
        {!isSuccess && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              <FieldError message={errors.email?.message} />
            </CardContent>
            <CardFooter className="mt-6">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Sending...' : 'Send reset link'}
              </Button>
            </CardFooter>
          </form>
        )}
        <CardFooter className={isSuccess ? '' : 'pt-0'}>
          <Link to="/login" className="text-sm text-foreground underline">
            Back to log in
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
