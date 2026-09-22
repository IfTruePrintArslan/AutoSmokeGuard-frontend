import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ErrorBoundary from './components/ui/ErrorBoundary'
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

// Pathless layout route that sits BETWEEN AppLayout and the pages, so a page
// that throws during render is contained inside AppLayout's <Outlet /> — the
// sidebar and topbar keep rendering and the user can navigate out of the
// broken screen. Keyed on the pathname so doing exactly that clears the
// caught error instead of pinning the panel to every subsequent route.
function PageErrorBoundary() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary
      resetKey={pathname}
      description="This page hit an unexpected error and could not be displayed. Your data is safe — pick another page from the sidebar, or reload."
    >
      <Outlet />
    </ErrorBoundary>
  )
}

function App() {
  return (
    // Outermost net: catches anything the per-page boundary below cannot —
    // a throw in AppLayout itself, in ProtectedRoute, or on a public auth
    // route — so a render-time TypeError can never white-screen the SPA.
    <ErrorBoundary>
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
            <Route element={<PageErrorBoundary />}>
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
    </ErrorBoundary>
  )
}

export default App
