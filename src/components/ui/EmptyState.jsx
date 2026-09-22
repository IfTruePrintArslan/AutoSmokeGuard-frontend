export default function EmptyState({ title, description, action, icon, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h3 className="text-[14.5px] font-semibold text-text">{title}</h3>
      {description && (
        <p className="text-[12.5px] text-text-2 mt-1.5 max-w-[380px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
