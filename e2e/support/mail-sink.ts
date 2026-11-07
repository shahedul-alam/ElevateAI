// Mail catcher for the verification e2e stack: an SMTP server that keeps every message the API sends,
// plus an HTTP endpoint the specs read them from. Node built-ins only; started by mail-sink-server.ts.
import { createServer as createHttpServer } from 'node:http'
import { createServer as createNetServer, type Socket } from 'node:net'

export const MAIL_SMTP_PORT = 2525
export const MAIL_HTTP_PORT = 4102

export type CapturedMail = {
  to: string[]
  subject: string
  contentType: string
  text: string
  html: string
}

const captured: CapturedMail[] = []

/** Lower-cased headers and body of a block. Folded header lines (leading whitespace) are joined. */
function split(block: string) {
  const at = block.indexOf('\r\n\r\n')
  const head = at === -1 ? block : block.slice(0, at)
  const headers: Record<string, string> = {}
  for (const line of head.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const colon = line.indexOf(':')
    if (colon > 0) headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim()
  }
  return { headers, body: at === -1 ? '' : block.slice(at + 4) }
}

function decode(body: string, encoding = '') {
  const enc = encoding.toLowerCase()
  if (enc === 'base64') return Buffer.from(body, 'base64').toString('utf8')
  if (enc === 'quoted-printable') {
    const bytes = body
      .replace(/=\r\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    return Buffer.from(bytes, 'latin1').toString('utf8')
  }
  return body
}

/** Reads the text and html parts of a message (multipart/alternative, or a single part). */
export function parseMessage(raw: string, to: string[]): CapturedMail {
  const { headers, body } = split(raw)
  const contentType = headers['content-type'] ?? 'text/plain'
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1]
  // Segment 0 is the preamble and the last one is the closing "--" marker.
  const parts = boundary
    ? body
        .split(`--${boundary}`)
        .slice(1)
        .filter((p) => !p.startsWith('--'))
        .map((p) => p.replace(/^\r\n/, '').replace(/\r\n$/, ''))
    : [raw]
  const mail: CapturedMail = { to, subject: headers.subject ?? '', contentType, text: '', html: '' }
  for (const part of parts) {
    const { headers: h, body: b } = split(part)
    const type = (h['content-type'] ?? 'text/plain').split(';')[0].trim().toLowerCase()
    if (type === 'text/plain') mail.text = decode(b, h['content-transfer-encoding'])
    if (type === 'text/html') mail.html = decode(b, h['content-transfer-encoding'])
  }
  return mail
}

// Plain SMTP, enough for nodemailer: no STARTTLS and no AUTH are advertised.
function smtpSession(socket: Socket) {
  let buffer = ''
  let recipients: string[] = []
  let data: string[] | null = null
  const reply = (line: string) => socket.write(`${line}\r\n`)
  socket.setEncoding('utf8')
  socket.on('error', () => {})
  reply('220 e2e-mail-sink ESMTP')
  socket.on('data', (chunk: string) => {
    buffer += chunk
    let end = buffer.indexOf('\r\n')
    while (end !== -1) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      end = buffer.indexOf('\r\n')
      if (data) {
        if (line === '.') {
          captured.push(parseMessage(data.join('\r\n'), recipients))
          data = null
          recipients = []
          reply('250 OK queued')
        } else data.push(line.startsWith('..') ? line.slice(1) : line)
        continue
      }
      const verb = line.slice(0, 4).toUpperCase()
      if (verb === 'EHLO' || verb === 'HELO') reply('250 e2e-mail-sink')
      else if (verb === 'MAIL') {
        recipients = []
        reply('250 OK')
      } else if (verb === 'RCPT') {
        recipients.push(line.match(/<([^>]*)>/)?.[1]?.toLowerCase() ?? '')
        reply('250 OK')
      } else if (verb === 'DATA') {
        data = []
        reply('354 End data with <CR><LF>.<CR><LF>')
      } else if (verb === 'RSET' || verb === 'NOOP') {
        recipients = []
        reply('250 OK')
      } else if (verb === 'QUIT') {
        reply('221 Bye')
        socket.end()
      } else reply('502 Command not implemented')
    }
  })
}

export function startMailSink() {
  createNetServer(smtpSession).listen(MAIL_SMTP_PORT, '127.0.0.1')
  createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/health') return res.end('ok')
    if (url.pathname === '/messages') {
      const to = url.searchParams.get('to')?.toLowerCase()
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify(captured.filter((m) => !to || m.to.includes(to))))
    }
    res.statusCode = 404
    res.end()
  }).listen(MAIL_HTTP_PORT, '127.0.0.1')
}
