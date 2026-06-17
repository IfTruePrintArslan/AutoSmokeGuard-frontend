import { Routes, Route } from 'react-router-dom'
import { useSelector } from 'react-redux'

function HomePage() {
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen)

  return (
    <div className="min-h-screen flex items-center justify-center text-2xl font-bold">
      AutoSmokeGuard — frontend ready
      {/* Redux exercised: sidebarOpen = {String(sidebarOpen)} */}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

export default App
