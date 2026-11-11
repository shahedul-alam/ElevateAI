export const READ_DAYS = 30
export const ANY_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** Read notifications older than `readBefore`, and any notification older than `anyBefore`, are expired. */
export const retentionCutoffs = (now: Date) => ({
  readBefore: new Date(now.getTime() - READ_DAYS * DAY_MS),
  anyBefore: new Date(now.getTime() - ANY_DAYS * DAY_MS),
})
