import { useLocation } from 'react-router-dom'

const PAGE_LABELS = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload',
  '/analysis': 'Live Analysis',
  '/reports': 'Reports',
  '/history': 'History',
  '/settings': 'Settings',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const label = PAGE_LABELS[pathname] ?? 'Dashboard'

  return (
    <div
      className="flex items-center gap-[14px] flex-shrink-0"
      style={{
        height: '64px',
        borderBottom: '1px solid var(--color-line)',
        padding: '0 28px',
        background: 'var(--color-bg)',
      }}
    >
      {/* Breadcrumb */}
      <div className="text-[12.5px] text-[#a3a3a3]">
        Workspace / <b className="text-[#ededed] font-semibold">{label}</b>
      </div>

      {/* Search — margin-left auto pushes it right */}
      <div
        className="flex items-center gap-[9px] text-[#6f6f6f] text-[13px]"
        style={{
          marginLeft: 'auto',
          width: '280px',
          height: '36px',
          padding: '0 12px',
          border: '1px solid var(--color-line-2)',
          borderRadius: '9px',
          background: '#121212',
        }}
      >
        {/* Search icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 truncate">Search reports, vehicles…</span>
        <kbd
          className="text-[10.5px] text-[#6f6f6f] px-[6px] py-[2px] rounded-[5px]"
          style={{
            marginLeft: 'auto',
            border: '1px solid var(--color-line-2)',
            background: '#1a1a1a',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Bell icon-btn */}
      <div
        className="flex items-center justify-center text-[#a3a3a3] relative"
        style={{
          width: '36px',
          height: '36px',
          border: '1px solid var(--color-line-2)',
          borderRadius: '9px',
          background: '#141414',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {/* Red notification dot */}
        <span
          className="absolute rounded-full"
          style={{
            top: '8px',
            right: '9px',
            width: '7px',
            height: '7px',
            background: '#f87171',
            border: '2px solid #141414',
          }}
        />
      </div>

      {/* New analysis button */}
      <button
        className="inline-flex items-center gap-[8px] font-semibold text-[13px] cursor-pointer"
        style={{
          height: '36px',
          padding: '0 16px',
          borderRadius: '9px',
          border: '1px solid transparent',
          background: '#fafafa',
          color: '#0a0a0a',
          fontFamily: 'var(--font-sans)',
          flexShrink: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New analysis
      </button>
    </div>
  )
}
