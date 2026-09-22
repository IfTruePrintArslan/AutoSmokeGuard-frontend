import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-bg text-center px-6">
      <div className="text-[54px] font-bold tracking-[-0.03em] text-text">404</div>
      <h1 className="text-[18px] font-semibold mt-2">Page not found</h1>
      <p className="text-[13px] text-text-2 mt-2 max-w-[360px]">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/dashboard" className="btn btn-pri mt-6 no-underline">
        Back to dashboard
      </Link>
    </div>
  )
}
