/**
 * Only http(s) URLs may become an href or a PDF link; anything else (javascript:, data:, ...) is
 * dropped. The server already stores only http(s) links, so this is a second check at the point of use.
 */
export function safeHref(url: string) {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
