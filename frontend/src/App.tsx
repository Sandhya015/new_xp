import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { StudentLayout } from './components/layout/StudentLayout'
import { CompanyLayout } from './components/layout/CompanyLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminLogin } from './pages/admin/AdminLogin'
import { Home } from './pages/public/Home'
import { About } from './pages/public/About'
import { Contact } from './pages/public/Contact'
import { Training } from './pages/public/Training'
import { CourseDetail } from './pages/public/CourseDetail'
import { Internship } from './pages/public/Internship'
import { CertVerify } from './pages/public/CertVerify'
import { Login } from './pages/public/Login'
import { Register } from './pages/public/Register'
import { ForgotPassword } from './pages/public/ForgotPassword'
import { Dashboard } from './pages/student/Dashboard'
import { MyCourses } from './pages/student/MyCourses'
import { CourseContent } from './pages/student/CourseContent'
import { Invoices } from './pages/student/Invoices'
import { Notifications } from './pages/student/Notifications'
import { Certificates } from './pages/student/Certificates'
import { Profile } from './pages/student/Profile'
import { Support } from './pages/student/Support'
import { Internships } from './pages/student/Internships'
import { CompanyDashboard } from './pages/company/CompanyDashboard'
import { CompanyProfile } from './pages/company/CompanyProfile'
import { PostInternship } from './pages/company/PostInternship'
import { ManageInternships } from './pages/company/ManageInternships'
import { Applicants } from './pages/company/Applicants'
import { SelectedCandidates } from './pages/company/SelectedCandidates'
import { Reports } from './pages/company/Reports'
import { CompanySupport } from './pages/company/CompanySupport'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { CourseManager } from './pages/admin/CourseManager'
import { StudentList } from './pages/admin/StudentList'
import { CertificateUpload } from './pages/admin/CertificateUpload'
import { LeadTracker } from './pages/admin/LeadTracker'
import { PaymentList } from './pages/admin/PaymentList'
import { OfferLetters } from './pages/admin/OfferLetters'
import { SystemSettings } from './pages/admin/SystemSettings'
import { CompanyManagement } from './pages/admin/CompanyManagement'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      {/* Student dashboard: no navbar/footer */}
      <Route path="/dashboard" element={<StudentLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="courses" element={<MyCourses />} />
        <Route path="courses/:id" element={<CourseContent />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="profile" element={<Profile />} />
        <Route path="support" element={<Support />} />
        <Route path="internships" element={<Internships />} />
      </Route>
      {/* Company dashboard: no navbar/footer */}
      <Route path="/company" element={<CompanyLayout />}>
        <Route index element={<CompanyDashboard />} />
        <Route path="profile" element={<CompanyProfile />} />
        <Route path="post-internship" element={<PostInternship />} />
        <Route path="internships" element={<ManageInternships />} />
        <Route path="applicants" element={<Applicants />} />
        <Route path="selected" element={<SelectedCandidates />} />
        <Route path="reports" element={<Reports />} />
        <Route path="support" element={<CompanySupport />} />
      </Route>
      {/* Admin panel: no navbar/footer */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="courses" element={<CourseManager />} />
        <Route path="students" element={<StudentList />} />
        <Route path="certificates" element={<CertificateUpload />} />
        <Route path="leads" element={<LeadTracker />} />
        <Route path="payments" element={<PaymentList />} />
        <Route path="offer-letters" element={<OfferLetters />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="companies" element={<CompanyManagement />} />
      </Route>
      <Route path="/*" element={
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/training" element={<Training />} />
            <Route path="/training/:id" element={<CourseDetail />} />
            <Route path="/internship" element={<Internship />} />
            <Route path="/verify" element={<CertVerify />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}

export default App
