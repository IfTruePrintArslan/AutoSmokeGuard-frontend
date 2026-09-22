import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { closeMobileNav } from '../../features/ui/uiSlice'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Toaster from '../ui/Toast'

export default function AppLayout() {
  const dispatch = useDispatch()
  const mobileNavOpen = useSelector((s) => s.ui.mobileNavOpen)

  return (
    /*
     * Responsive shell:
     * - lg+ : fixed full-viewport box (h-screen + overflow-hidden); the 236px
     *   sidebar rail is in-flow and the content area scrolls internally.
     * - <lg : natural height (min-h-screen) so the whole page scrolls normally;
     *   the sidebar is removed from flow and rendered as an off-canvas drawer.
     */
    <div
      className="flex min-h-screen min-[769px]:h-screen min-[769px]:overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      <Sidebar />

      {/* Backdrop — only visible while the mobile drawer is open (<lg) */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 min-[769px]:hidden"
          aria-hidden="true"
          onClick={() => dispatch(closeMobileNav())}
        />
      )}

      {/* Main column */}
      <div className="flex flex-col min-w-0 flex-1">
        <Topbar />

        {/* Content area — scrollable on desktop, grows naturally on mobile */}
        <div className="flex-1 min-[769px]:overflow-auto p-4 sm:p-5 min-[769px]:px-7 min-[769px]:py-6">
          <Outlet />
        </div>
      </div>

      <Toaster />
    </div>
  )
}
