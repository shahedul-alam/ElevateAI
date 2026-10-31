import { Route, Routes } from 'react-router'

import { Navbar } from '@/components/navbar'
import { Toaster } from '@/components/ui/sonner'
import { useSession } from '@/features/auth/use-session'
import Applications from '@/pages/applications'
import EmployerApplicants from '@/pages/employer-applicants'
import EmployerJobForm from '@/pages/employer-job-form'
import EmployerJobs from '@/pages/employer-jobs'
import Home from '@/pages/home'
import JobDetail from '@/pages/job-detail'
import Jobs from '@/pages/jobs'
import Login from '@/pages/login'
import Register from '@/pages/register'
import Resume from '@/pages/resume'

function App() {
  useSession()

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/employer/jobs" element={<EmployerJobs />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/employer/jobs/:id/applicants" element={<EmployerApplicants />} />
        <Route path="/employer/jobs/new" element={<EmployerJobForm />} />
        <Route path="/employer/jobs/:id/edit" element={<EmployerJobForm />} />
      </Routes>
      <Toaster richColors />
    </>
  )
}

export default App
