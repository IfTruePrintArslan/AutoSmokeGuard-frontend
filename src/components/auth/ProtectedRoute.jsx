import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function ProtectedRoute() {
  const location = useLocation()
  const bootstrapped = useSelector((state) => state.auth.bootstrapped)
  const user = useSelector((state) => state.auth.user)

  // Wait for the initial bootstrap() check (reading storage + verifying the
  // token against /api/me) before making a redirect decision — otherwise a
  // page refresh would bounce a valid session to /login for a split second.
  if (!bootstrapped) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-bg">
        <div className="flex flex-col items-center gap-3 text-text-2">
          <div className="w-7 h-7 rounded-full border-2 border-line-2 border-t-text animate-spin" />
          <span className="text-[12.5px]">Loading…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
