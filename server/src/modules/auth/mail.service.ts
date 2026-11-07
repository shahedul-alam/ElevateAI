import nodemailer from 'nodemailer'
import { env } from '../../config/env'

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null

type Mail = { to: string; subject: string; text: string; html?: string }

/** Fire-and-forget: callers do not await it (keeps response timing equal for known and unknown emails). */
export function sendMail({ to, subject, text, html }: Mail): void {
  if (!transport) {
    // No SMTP configured: print the mail so links are usable in development.
    console.log(`[mail] to=${to} subject="${subject}"\n${text}`)
    return
  }
  transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html }).catch((e) => console.error('[mail] send failed', e))
}
