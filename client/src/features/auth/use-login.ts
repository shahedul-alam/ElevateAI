import { useMutation } from '@tanstack/react-query'

import { loginRequest } from './auth.api'

export function useLogin() {
  return useMutation({ mutationFn: loginRequest })
}
