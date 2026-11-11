import { useMutation } from '@tanstack/react-query'

import { requestPasswordResetRequest } from './auth.api'

export function useForgotPassword() {
  return useMutation({ mutationFn: requestPasswordResetRequest })
}
