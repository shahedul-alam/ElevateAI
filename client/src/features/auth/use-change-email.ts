import { useMutation } from '@tanstack/react-query'

import { changeEmailRequest } from './auth.api'

export function useChangeEmail() {
  return useMutation({ mutationFn: changeEmailRequest })
}
