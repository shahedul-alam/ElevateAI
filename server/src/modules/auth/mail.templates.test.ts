import { describe, expect, test } from 'bun:test'
import { approveEmailChangeMail, verifyEmailMail } from './mail.templates'

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
})
