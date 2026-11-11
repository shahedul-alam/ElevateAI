import { describe, expect, test } from 'bun:test'
import { applicationStatusMail, approveEmailChangeMail, verifyEmailMail } from './mail.templates'

describe('mail templates', () => {
  test('puts the link in both parts and escapes HTML', () => {
    const url = 'http://x.test/a?b=1&c="2"'
    const mail = verifyEmailMail(url)
    expect(mail.text).toContain(url)
    expect(mail.html).toContain('b=1&amp;c=&quot;2&quot;')
    expect(mail.html).not.toContain('c="2"')
  })

  test('escapes the user-supplied new address', () => {
    const mail = approveEmailChangeMail('<script>@x.test', 'http://x.test')
    expect(mail.html).not.toContain('<script>')
  })

  test('status mail has the link in both parts, escapes the job title and keeps the subject on one line', () => {
    const mail = applicationStatusMail({
      title: 'Offer: <script>\r\nBcc: x@y.test',
      body: 'Acme moved your application for <b>Dev</b>.',
      url: 'http://x.test/applications',
      settingsUrl: 'http://x.test/account',
    })
    expect(mail.text).toContain('http://x.test/applications')
    expect(mail.html).toContain('http://x.test/applications')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>')
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })
})
