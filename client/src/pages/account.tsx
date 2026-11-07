import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'

import { FieldError } from '@/components/field-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeEmailSchema, type ChangeEmailInput } from '@/features/auth/auth.schema'
import { PENDING_EMAIL_KEY, withdrawAiConsentRequest } from '@/features/auth/auth.api'
import { SESSION_KEY } from '@/features/auth/use-session'
import { useAuthStore } from '@/features/auth/auth.store'
import { useChangeEmail } from '@/features/auth/use-change-email'
import { getApiError } from '@/lib/api'

export default function Account() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const { mutate, isPending, isSuccess } = useChangeEmail()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: '' },
  })

  if (status === 'loading') return null
  if (!user) return <Navigate to="/login" replace />

  const onSubmit = ({ newEmail }: ChangeEmailInput) => {
    mutate(newEmail, {
      // Lets /verify-email tell the approval step from the final one; best effort only.
      onSuccess: () => {
        try {
          localStorage.setItem(PENDING_EMAIL_KEY, newEmail.toLowerCase())
        } catch {}
      },
      onError: (err) => {
        const { status: code, message } = getApiError(err)
        toast.error(code === 429 ? 'Too many attempts' : 'Could not change email', {
          description: code === 429 ? 'Please wait a minute and try again.' : message,
        })
      },
    })
  }

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Change email</CardTitle>
          <CardDescription>
            {isSuccess
              ? `We sent an approval link to ${user.email}. After you approve, we will send a verification link to the new address. Your email changes once both are done.`
              : `Your current email is ${user.email}.`}
          </CardDescription>
        </CardHeader>
        {!isSuccess && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="newEmail">New email</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.newEmail}
                {...register('newEmail')}
              />
              <FieldError message={errors.newEmail?.message} />
            </CardContent>
            <CardFooter className="mt-6">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Sending...' : 'Send approval link'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      <AiConsentCard />
    </main>
  )
}

/** Shows whether AI features may use the user's text, and lets them withdraw. */
function AiConsentCard() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()
  const withdraw = useMutation({
    mutationFn: withdrawAiConsentRequest,
    onSuccess: () => {
      if (user) setUser({ ...user, aiConsent: false })
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY })
      toast.success('AI consent withdrawn')
    },
    onError: (err) => toast.error('Could not withdraw', { description: getApiError(err).message }),
  })
  if (!user) return null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI features</CardTitle>
        <CardDescription>
          {user.aiConsent
            ? 'You agreed to send the text you use with AI features to OpenAI. '
            : 'You have not agreed yet. You will be asked the first time you use an AI feature. '}
          <Link to="/privacy" className="underline">
            Read the AI privacy notice
          </Link>
          .
        </CardDescription>
      </CardHeader>
      {user.aiConsent && (
        <CardFooter>
          <Button type="button" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
            {withdraw.isPending ? 'Withdrawing...' : 'Withdraw consent'}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
