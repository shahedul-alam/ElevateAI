export const SIGNUP_ROLES = ['candidate', 'employer'] as const

// The OAuth state's additionalData comes from the client, so only the two sign-up roles pass; anything else is a candidate.
export function resolveSocialRole(requested: unknown): (typeof SIGNUP_ROLES)[number] {
  return SIGNUP_ROLES.find((r) => r === requested) ?? 'candidate'
}
