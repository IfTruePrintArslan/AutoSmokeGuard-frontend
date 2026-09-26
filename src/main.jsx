import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import store from './app/store'
import { bootstrap, authCleared } from './features/auth/authSlice'
import './index.css'
import App from './App.jsx'

// Restore a session from storage (and verify it against /api/me) before the
// app finishes mounting, so a page refresh keeps the user logged in.
store.dispatch(bootstrap())

// The api client fires this when a token refresh fails outright — sync the
// store so protected routes immediately react and bounce to /login.
window.addEventListener('asg:unauthorized', () => {
  store.dispatch(authCleared())
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
