import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../../features/auth/authSlice'
import { closeMobileNav } from '../../features/ui/uiSlice'

/* ---------- SVG Icons (verbatim from 02_dashboard.html, JSX-ified) ---------- */

function IconDashboard() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3" />
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
    </svg>
  )
}

function IconAnalysis() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

function IconReports() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

/* ---------- NavLink helper ---------- */
function SideNavLink({ to, icon, children, badge, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-[11px] px-[10px] py-[9px] rounded-[9px] no-underline font-medium text-[13.5px] mb-[2px] transition-colors',
          isActive
            ? 'bg-[#1d1d1d] text-[#fafafa] font-semibold [&_svg]:opacity-100'
            : 'text-[#a3a3a3] [&_svg]:opacity-75',
        ].join(' ')
      }
    >
      {icon}
      {children}
      {badge && (
        <span
          className="ml-auto text-[10.5px] font-semibold bg-[#262626] text-[#a3a3a3] px-[7px] py-[2px] rounded-full"
        >
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ---------- Sidebar ---------- */
export default function Sidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const mobileNavOpen = useSelector((state) => state.ui.mobileNavOpen)

  const closeNav = () => dispatch(closeMobileNav())

  // Esc closes the mobile drawer
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') dispatch(closeMobileNav())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen, dispatch])

  // Derive display values — fall back to static placeholder if no user
  const displayName = user?.name || 'Memoon Ahmed'
  const displaySub = user?.email || 'Transport Authority'
  // Avatar initials: up to 2 chars from name
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function handleLogout() {
    dispatch(closeMobileNav())
    dispatch(logout())
    navigate('/login')
  }

  return (
    <aside
      className={[
        'flex flex-col w-[236px] flex-shrink-0 px-[14px] py-5',
        // <lg : off-canvas drawer
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        // lg+ : static in-flow rail
        'lg:static lg:translate-x-0 lg:z-auto',
      ].join(' ')}
      style={{
        borderRight: '1px solid var(--color-line)',
        background: '#0e0e0e',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] px-[10px] pb-[22px] pt-[4px]">
        <div
          className="flex items-center justify-center rounded-[10px] bg-[#fafafa]"
          style={{ width: '34px', height: '34px', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5.5v5.2c0 4.9 3.4 9.5 8 10.8 4.6-1.3 8-5.9 8-10.8V5.5z" />
            <path d="m9 12 2 2 4-4.5" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-[14.5px] leading-none tracking-[-0.02em]">
            AutoSmoke<span className="text-[#a3a3a3]">Guard</span>
          </div>
          <div className="text-[10.5px] text-[#6f6f6f] mt-[1px]">Emission monitoring</div>
        </div>
      </div>

      {/* Workspace nav group */}
      <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-[#6f6f6f] px-[10px] pt-[14px] pb-[8px]">
        Workspace
      </div>
      <nav className="flex flex-col">
        <SideNavLink to="/dashboard" icon={<IconDashboard />} onNavigate={closeNav}>
          Dashboard
        </SideNavLink>
        <SideNavLink to="/upload" icon={<IconUpload />} onNavigate={closeNav}>
          Upload
        </SideNavLink>
        <SideNavLink to="/analysis" icon={<IconAnalysis />} badge="2 running" onNavigate={closeNav}>
          Live Analysis
        </SideNavLink>
        <SideNavLink to="/reports" icon={<IconReports />} onNavigate={closeNav}>
          Reports
        </SideNavLink>
        <SideNavLink to="/history" icon={<IconHistory />} onNavigate={closeNav}>
          History
        </SideNavLink>
      </nav>

      {/* System nav group */}
      <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-[#6f6f6f] px-[10px] pt-[14px] pb-[8px]">
        System
      </div>
      <nav className="flex flex-col">
        <SideNavLink to="/settings" icon={<IconSettings />} onNavigate={closeNav}>
          Settings
        </SideNavLink>
      </nav>

      {/* Footer */}
      <div className="mt-auto">
        {/* Upgrade card */}
        <div
          className="rounded-[12px] p-[13px] mb-[14px]"
          style={{
            border: '1px solid var(--color-line-2)',
            background: '#141414',
          }}
        >
          <b className="block text-[12.5px] font-semibold mb-[3px]">Model v2.4 available</b>
          <p className="text-[11.5px] text-[#a3a3a3] leading-[1.45]">
            Improved smoke segmentation for night footage.
          </p>
        </div>

        {/* User card with logout button */}
        <div
          className="flex items-center gap-[10px] p-[10px] rounded-[10px]"
          style={{
            border: '1px solid var(--color-line)',
            background: '#141414',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{ width: '32px', height: '32px', background: '#3a3a3a', flexShrink: 0 }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="block text-[12.5px] font-semibold truncate">{displayName}</b>
            <span className="text-[11px] text-[#6f6f6f] truncate block">{displaySub}</span>
          </div>
          {/* Logout icon button */}
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--color-line)',
              borderRadius: '7px',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f87171'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-muted)'
              e.currentTarget.style.borderColor = 'var(--color-line)'
            }}
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  )
}
