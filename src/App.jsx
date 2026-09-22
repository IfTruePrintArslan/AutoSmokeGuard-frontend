import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Spinner from './components/ui/Spinner'
import LoginPage from './pages/LoginPage'

const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg)' }}>
    <Spinner size={24} />
  </div>
)

function App() {
  return (
    <Routes>
      {/* Public auth routes — outside AppLayout */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/register"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <RegisterPage />
          </Suspense>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/reset-password"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />

      {/* Protected: token required, else bounce to /login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/upload"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <UploadPage />
              </Suspense>
            }
          />
          <Route
            path="/analysis"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <AnalysisPage />
              </Suspense>
            }
          />
          <Route
            path="/analysis/:analysisId"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <AnalysisPage />
              </Suspense>
            }
          />
          <Route
            path="/reports"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="/history"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Redirect root to dashboard (ProtectedRoute will bounce to /login if unauthed) */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Catch-all */}
      <Route
        path="*"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default App
