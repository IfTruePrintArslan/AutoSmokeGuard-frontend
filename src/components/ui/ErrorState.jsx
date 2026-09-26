export default function ErrorState({ message = 'Something went wrong.', onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      <div className="w-11 h-11 rounded-full bg-high-bg text-high flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-[13px] text-text-2 max-w-[380px] leading-relaxed">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
