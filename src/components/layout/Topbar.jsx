import { useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { openMobileNav } from '../../features/ui/uiSlice'

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
  const dispatch = useDispatch()
  const label = PAGE_LABELS[pathname] ?? 'Dashboard'

  return (
    <div
      className="flex items-center gap-[14px] flex-shrink-0 px-4 sm:px-5 min-[769px]:px-7"
      style={{
        height: '64px',
        borderBottom: '1px solid var(--color-line)',
        background: 'var(--color-bg)',
      }}
    >
      {/* Hamburger — opens the off-canvas drawer (<lg only) */}
      <button
        type="button"
        onClick={() => dispatch(openMobileNav())}
        aria-label="Open navigation menu"
        className="min-[769px]:hidden flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-[9px] border border-line-2 bg-[#141414] text-[#a3a3a3]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Breadcrumb */}
      <div className="text-[12.5px] text-[#a3a3a3] truncate">
        <span className="hidden sm:inline">Workspace / </span>
        <b className="text-[#ededed] font-semibold">{label}</b>
      </div>

      {/* Search — full box on lg+, icon-only button below lg.
          ml-auto pushes the right-hand cluster to the edge. */}
      <div
        className="hidden min-[769px]:flex items-center gap-[9px] text-[#6f6f6f] text-[13px] ml-auto"
        style={{
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

      {/* Collapsed search icon-button (<lg) */}
      <button
        type="button"
        aria-label="Search"
        className="min-[769px]:hidden flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-[9px] border border-line-2 bg-[#121212] text-[#6f6f6f] ml-auto"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

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

      {/* New analysis button — label hidden on very small widths (icon-only) */}
      <button
        className="inline-flex items-center gap-[8px] font-semibold text-[13px] cursor-pointer"
        style={{
          height: '36px',
          borderRadius: '9px',
          border: '1px solid transparent',
          background: '#fafafa',
          color: '#0a0a0a',
          fontFamily: 'var(--font-sans)',
          flexShrink: 0,
        }}
      >
        <span className="inline-flex items-center gap-[8px] px-3 sm:px-4 h-full">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="hidden sm:inline">New analysis</span>
        </span>
      </button>
    </div>
  )
}
