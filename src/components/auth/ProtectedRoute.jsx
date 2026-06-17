import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const token = useSelector((state) => state.auth.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
