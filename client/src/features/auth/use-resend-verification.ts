import { useMutation } from '@tanstack/react-query'

import { resendVerificationRequest } from './auth.api'

export function useResendVerification() {
  return useMutation({ mutationFn: resendVerificationRequest })
}
