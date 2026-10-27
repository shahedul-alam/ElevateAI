import { useMutation } from '@tanstack/react-query'

import { registerRequest } from './auth.api'

export function useRegister() {
  return useMutation({ mutationFn: registerRequest })
}
