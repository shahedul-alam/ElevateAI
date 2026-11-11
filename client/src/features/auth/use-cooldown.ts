import { useEffect, useState } from 'react'

/** Counts down `seconds` after `start()`; the server rate-limits too, this just stops needless clicks. */
export function useCooldown(seconds = 60) {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  return { left, start: () => setLeft(seconds) }
}
