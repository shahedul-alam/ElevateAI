export type MailContent = { subject: string; text: string; html: string }

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type Parts = { subject: string; heading: string; body: string; button?: { label: string; url: string }; footer: string }

// Inline styles and one table-free card: the lowest common denominator for mail clients.
function render({ subject, heading, body, button, footer }: Parts): MailContent {
  const text = [heading, '', body, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', footer].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
<p style="margin:0 0 24px;font-size:18px;font-weight:bold">ElevateAI</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
${
  button
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px">${escapeHtml(button.label)}</a></p>
<p style="margin:0 0 24px;font-size:12px;color:#71717a;word-break:break-all">Or paste this link into your browser:<br>${escapeHtml(button.url)}</p>`
    : ''
}
<p style="margin:0;font-size:12px;color:#71717a">${escapeHtml(footer)}</p>
</div></body></html>`
  return { subject, text, html }
}

export const verifyEmailMail = (url: string) =>
  render({
    subject: 'Verify your ElevateAI email',
    heading: 'Confirm your email address',
    body: 'Click the button to verify your email. The link is valid for 1 hour.',
    button: { label: 'Verify email', url },
    footer: 'If you did not create an ElevateAI account, you can ignore this email.',
  })

export const resetPasswordMail = (url: string) =>
  render({
    subject: 'Reset your ElevateAI password',
    heading: 'Choose a new password',
    body: 'Click the button to set a new password. The link is valid for 1 hour and works once.',
    button: { label: 'Reset password', url },
    footer: 'If you did not ask for this, ignore this email. Your password stays the same.',
  })

export const approveEmailChangeMail = (newEmail: string, url: string) =>
  render({
    subject: 'Approve your ElevateAI email change',
    heading: 'Approve email change',
    body: `Someone asked to change your ElevateAI email to ${newEmail}. Approve it to continue; we will then send a verification link to the new address.`,
    button: { label: 'Approve change', url },
    footer: 'If this was not you, ignore this email and consider changing your password.',
  })

export const existingAccountMail = (loginUrl: string, resetUrl: string) =>
  render({
    subject: 'Sign-up attempt with your email',
    heading: 'You already have an account',
    body: `Someone tried to create an ElevateAI account with this email address. If it was you, log in instead (${loginUrl}) or reset your password if you forgot it (${resetUrl}).`,
    footer: 'If it was not you, you can safely ignore this email.',
  })

/** `title` and `body` come from `statusMessage`, so the email and the in-app notification read the same. */
export const applicationStatusMail = ({ title, body, url, settingsUrl }: { title: string; body: string; url: string; settingsUrl: string }) =>
  render({
    // Subjects are headers: no line breaks, whatever the job title holds.
    subject: title.replace(/\s+/g, ' '),
    heading: title,
    body,
    button: { label: 'View application', url },
    footer: `You get this email because your application status changed. You can turn these emails off at ${settingsUrl}`,
  })
