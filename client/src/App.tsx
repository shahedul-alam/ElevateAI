import { Route, Routes } from 'react-router'

import { Navbar } from '@/components/navbar'
import { SiteFooter } from '@/components/site-footer'
import { Toaster } from '@/components/ui/sonner'
import { useResetCacheOnUserChange } from '@/features/auth/use-reset-cache-on-user-change'
import { useSession } from '@/features/auth/use-session'
import Admin from '@/pages/admin'
import Applications from '@/pages/applications'
import CompanyPage from '@/pages/company'
import Dashboard from '@/pages/dashboard'
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
import Account from '@/pages/account'
import ForgotPassword from '@/pages/forgot-password'
import ResetPassword from '@/pages/reset-password'
import VerifyEmail from '@/pages/verify-email'
import Resume from '@/pages/resume'
import NotFound from '@/pages/not-found'
import Privacy from '@/pages/privacy'
import ResumePreview from '@/pages/resume-preview'

function App() {
  useSession()
  useResetCacheOnUserChange()

  return (
    <>
      <div className="flex min-h-svh flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/account" element={<Account />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <SiteFooter />
      </div>
      <Toaster richColors />
    </>
  )
}

export default App
