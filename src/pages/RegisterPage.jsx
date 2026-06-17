import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { register } from '../features/auth/authSlice'
import AuthHero from '../components/auth/AuthHero'
import '../styles/auth.css'

export default function RegisterPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const status = useSelector((state) => state.auth.status)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [inlineError, setInlineError] = useState('')

  const isPending = status === 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password || !confirm) {
      setInlineError('All fields are required.')
      return
    }
    if (password !== confirm) {
      setInlineError('Passwords do not match.')
      return
    }
    setInlineError('')
    const result = await dispatch(register({ name: name.trim(), email: email.trim(), password }))
    if (register.fulfilled.match(result)) {
      navigate('/dashboard')
    } else {
      setInlineError(result.payload || 'Registration failed.')
    }
  }

  return (
    <div className="login">
      <AuthHero />

      <div className="l-right">
        <div className="l-form">
          <h1>Create your account</h1>
          <p className="l-sub">Start analyzing vehicle emissions.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="reg-name">Name</label>
            <input
              id="reg-name"
              type="text"
              className="input"
              placeholder="Hamza Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />

            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className="input"
              placeholder="hamza@transport.gov.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="input"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <label htmlFor="reg-confirm">Confirm password</label>
            <input
              id="reg-confirm"
              type="password"
              className="input"
              placeholder="••••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {inlineError && <p className="l-error">{inlineError}</p>}

            <button
              type="submit"
              className="auth-btn auth-btn-pri l-btn"
              disabled={isPending}
            >
              {isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="divider"><span>or</span></div>

          <button
            type="button"
            className="auth-btn auth-btn-ghost l-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6a5.1 5.1 0 0 1-2.3 3.4v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.2z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.9A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V6.9H2.1a11 11 0 0 0 0 10z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 6.9l3.7 2.9c.9-2.7 3.3-4.4 6.2-4.4z" />
            </svg>
            Continue with Google
          </button>

          <p className="l-foot">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
