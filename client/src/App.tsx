import { Route, Routes } from 'react-router'

import { Navbar } from '@/components/navbar'
import { Toaster } from '@/components/ui/sonner'
import { useResetCacheOnUserChange } from '@/features/auth/use-reset-cache-on-user-change'
import { useSession } from '@/features/auth/use-session'
import Applications from '@/pages/applications'
import CompanyPage from '@/pages/company'
import Companies from '@/pages/companies'
import EmployerApplicants from '@/pages/employer-applicants'
import EmployerHiring from '@/pages/employer-hiring'
import EmployerCompany from '@/pages/employer-company'
import EmployerJobForm from '@/pages/employer-job-form'
import EmployerJobs from '@/pages/employer-jobs'
import Home from '@/pages/home'
import JobDetail from '@/pages/job-detail'
import Jobs from '@/pages/jobs'
import Login from '@/pages/login'
import Register from '@/pages/register'
import Resume from '@/pages/resume'
import ResumePreview from '@/pages/resume-preview'

function App() {
  useSession()
  useResetCacheOnUserChange()

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/resume/preview" element={<ResumePreview />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyPage />} />
        <Route path="/employer/company" element={<EmployerCompany />} />
        <Route path="/employer/jobs" element={<EmployerJobs />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/employer/jobs/:id/applicants" element={<EmployerApplicants />} />
        <Route path="/employer/hiring" element={<EmployerHiring />} />
        <Route path="/employer/jobs/new" element={<EmployerJobForm />} />
        <Route path="/employer/jobs/:id/edit" element={<EmployerJobForm />} />
      </Routes>
      <Toaster richColors />
    </>
  )
}

export default App
