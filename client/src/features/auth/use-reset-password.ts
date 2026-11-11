import { useMutation } from '@tanstack/react-query'

import { resetPasswordRequest } from './auth.api'

export function useResetPassword() {
  return useMutation({ mutationFn: resetPasswordRequest })
}
