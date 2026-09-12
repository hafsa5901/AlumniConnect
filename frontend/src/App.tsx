import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute';

// Lazy-loaded pages
const LandingPage            = lazy(() => import('./pages/LandingPage'));
const LoginPage              = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage           = lazy(() => import('./pages/auth/RegisterPage'));
const VerifyEmailPage        = lazy(() => import('./pages/auth/VerifyEmailPage'));
const ForgotPasswordPage     = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage      = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerificationStatusPage = lazy(() => import('./pages/auth/VerificationStatusPage'));
const UnauthorizedPage       = lazy(() => import('./pages/UnauthorizedPage'));
const NotFoundPage           = lazy(() => import('./pages/NotFoundPage'));

// Dashboards & Phase 3B Pages
const DashboardRouter        = lazy(() => import('./pages/dashboard/DashboardRouter'));
const StudentDashboard       = lazy(() => import('./pages/dashboard/StudentDashboard'));
const AlumniDashboard        = lazy(() => import('./pages/dashboard/AlumniDashboard'));
const AdminDashboard         = lazy(() => import('./pages/dashboard/AdminDashboard'));
const VerificationPage       = lazy(() => import('./pages/admin/VerificationPage'));
const AlumniDirectoryPage    = lazy(() => import('./pages/alumni/AlumniDirectoryPage'));
const AlumniProfilePage      = lazy(() => import('./pages/alumni/AlumniProfilePage'));
const ProfileViewPage        = lazy(() => import('./pages/profile/ProfileViewPage'));
const ProfileEditPage        = lazy(() => import('./pages/profile/ProfileEditPage'));
const SettingsPage           = lazy(() => import('./pages/settings/SettingsPage'));

// Phase 4A: Events
const EventsPage             = lazy(() => import('./pages/events/EventsPage'));
const EventDetailPage        = lazy(() => import('./pages/events/EventDetailPage'));
const AdminEventsPage        = lazy(() => import('./pages/admin/AdminEventsPage'));

// Phase 4B: Jobs
const JobsPage               = lazy(() => import('./pages/jobs/JobsPage'));
const JobDetailPage          = lazy(() => import('./pages/jobs/JobDetailPage'));

// Phase 4C: Mentorship
const MentorshipPage         = lazy(() => import('./pages/mentorship/MentorshipPage'));

// Phase 4D: Admin User Governance & Audit Logs
const AdminUsersPage         = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminAuditLogsPage     = lazy(() => import('./pages/admin/AdminAuditLogsPage'));

// Phase 5A: Real-Time Messaging
const MessagesPage           = lazy(() => import('./pages/messages/MessagesPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-navy-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnlyRoute>
                    <RegisterPage />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verification-status" element={<VerificationStatusPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Directory & Profiles */}
              <Route path="/alumni" element={<AlumniDirectoryPage />} />
              <Route path="/alumni/:id" element={<AlumniProfilePage />} />

              {/* Phase 4A: Events */}
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <EventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/:id"
                element={
                  <ProtectedRoute>
                    <EventDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 4B: Jobs */}
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute>
                    <JobsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <ProtectedRoute>
                    <JobDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 4C: Mentorship */}
              <Route
                path="/mentorship"
                element={
                  <ProtectedRoute>
                    <MentorshipPage />
                  </ProtectedRoute>
                }
              />

              {/* Phase 5A: Messages */}
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <MessagesPage />
                  </ProtectedRoute>
                }
              />

              {/* Authenticated Dashboard Root */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardRouter />
                  </ProtectedRoute>
                }
              />

              {/* Student */}
              <Route
                path="/dashboard/student/*"
                element={
                  <ProtectedRoute roles={['student']}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Alumni */}
              <Route
                path="/dashboard/alumni/*"
                element={
                  <ProtectedRoute roles={['alumni']}>
                    <AlumniDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Admin */}
              <Route
                path="/dashboard/admin/*"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/verification"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <VerificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/events"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminEventsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminAuditLogsPage />
                  </ProtectedRoute>
                }
              />

              {/* User Profile & Settings */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileViewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/edit"
                element={
                  <ProtectedRoute>
                    <ProfileEditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          {/* Global toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '14px',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              },
              success: { iconTheme: { primary: '#0F1E3D', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
