import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  return (
    /*
     * Full-viewport responsive adaptation:
     * The mockup's fixed 1440x900 box becomes a min-h-screen flex row.
     * Sidebar keeps its fixed 236px width; main column is flex-1 min-w-0.
     * Every other visual detail (colors, borders, paddings, font sizes, radii)
     * matches style.css exactly. This fixed→fluid change is the ONLY deviation.
     */
    <div
      className="flex"
      style={{ minHeight: '100vh', background: 'var(--color-bg)' }}
    >
      <Sidebar />

      {/* Main column */}
      <div
        className="flex flex-col min-w-0"
        style={{ flex: 1 }}
      >
        <Topbar />

        {/* Content area — scrollable */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '26px 28px',
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  )
}
