import { expect } from '@playwright/test'
import { type CapturedMail, MAIL_HTTP_PORT } from './mail-sink'

const MAIL_API = `http://127.0.0.1:${MAIL_HTTP_PORT}`

/** Every mail the verification stack has sent to this address so far. */
export async function mailsTo(email: string): Promise<CapturedMail[]> {
  const res = await fetch(`${MAIL_API}/messages?to=${encodeURIComponent(email)}`)
  return res.json()
}

export async function mailCount(email: string, subject: string) {
  return (await mailsTo(email)).filter((m) => m.subject === subject).length
}

/** The API sends mail in the background, so poll until one with this subject arrives; returns the latest. */
export async function waitForMail(email: string, subject: string) {
  await expect.poll(() => mailCount(email, subject), { timeout: 15_000 }).toBeGreaterThan(0)
  const mails = (await mailsTo(email)).filter((m) => m.subject === subject)
  return mails[mails.length - 1]
}

/** The first link in the text part. The html part carries the same link, escaped. */
export function linkIn(mail: CapturedMail) {
  const link = mail.text.match(/https?:\/\/\S+/)?.[0]
  if (!link) throw new Error(`no link in mail "${mail.subject}"`)
  return link
}
