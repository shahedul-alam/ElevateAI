import { Route, Routes } from 'react-router'

import { Navbar } from '@/components/navbar'
import { Toaster } from '@/components/ui/sonner'
import { useSession } from '@/features/auth/use-session'
import Home from '@/pages/home'
import Login from '@/pages/login'
import Register from '@/pages/register'

function App() {
  useSession()

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <Toaster richColors />
    </>
  )
}

export default App
