import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-2">
      <h1 className="text-4xl font-bold">ElevateAI</h1>
      <p className="text-sm text-neutral-500">API status: {status}</p>
    </main>
  )
}

export default App
