import { useEffect, useState } from 'react'

export default function Home() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main className="flex flex-col items-center justify-center gap-2 py-24">
      <h1 className="text-4xl font-bold">ElevateAI</h1>
      <p className="text-sm text-muted-foreground">API status: {status}</p>
    </main>
  )
}
