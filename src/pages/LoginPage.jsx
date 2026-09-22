import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { login } from '../features/auth/authSlice'
import AuthHero from '../components/auth/AuthHero'
import { validateEmail, validatePassword } from '../lib/validation'
import { splitServerErrors } from '../lib/formErrors'

const inputCls = (hasError) =>
  `h-[42px] w-full border rounded-[9px] bg-surface flex items-center px-[14px] text-[13.5px] text-text font-[inherit] outline-none transition-[border-color] duration-150 placeholder:text-muted ${hasError ? 'border-[#f87171] mb-1.5 focus:border-[#f87171]' : 'border-line-2 mb-[18px] focus:border-line-2 focus:shadow-[0_0_0_2px_rgba(250,250,250,0.06)]'}`

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useSelector((state) => state.auth.status)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inlineError, setInlineError] = useState('')
  const [errors, setErrors] = useState({})

  const isPending = status === 'pending'
  const flash = location.state?.flash

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password, false),
    }
    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setInlineError('')
    const result = await dispatch(login({ email: email.trim(), password }))
    if (login.fulfilled.match(result)) {
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } else {
      const { fieldErrors, inlineError: msg } = splitServerErrors(result.payload, ['email', 'password'])
      setErrors((prev) => ({ ...prev, ...fieldErrors }))
      setInlineError(msg)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-bg">
      <AuthHero />

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[24px] font-[660] tracking-[-0.02em]">Welcome back</h1>
          <p className="text-text-2 text-[13.5px] mt-[7px] mb-7">Sign in to analyze vehicle emissions.</p>

          {flash && (
            <p className="text-[12.5px] text-low bg-low-bg border border-low/20 rounded-[9px] px-3 py-2.5 mb-5">
              {flash}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email" className="block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]">Email</label>
            <input
              id="login-email"
              type="email"
              className={inputCls(!!errors.email)}
              placeholder="hamza@transport.gov.pk"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.email}</p>}

            <label htmlFor="login-password" className="block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]">
              Password
              <Link to="/forgot-password" className="link float-right text-[12px] font-medium">
                Forgot password?
              </Link>
            </label>
            <input
              id="login-password"
              type="password"
              className={inputCls(!!errors.password)}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password, false) }))}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.password}</p>}

            {inlineError && <p className="text-[12px] text-[#f87171] mb-3 -mt-2.5">{inlineError}</p>}

            <button
              type="submit"
              className="btn btn-pri w-full h-[42px] justify-center text-[13.5px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center gap-3 text-muted text-[11.5px] my-[18px] before:content-[''] before:flex-1 before:h-px before:bg-line after:content-[''] after:flex-1 after:h-px after:bg-line"><span>or</span></div>

          <button
            type="button"
            className="btn btn-ghost w-full h-[42px] justify-center text-[13.5px] mt-1"
          >
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6a5.1 5.1 0 0 1-2.3 3.4v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.2z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.9A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V6.9H2.1a11 11 0 0 0 0 10z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 6.9l3.7 2.9c.9-2.7 3.3-4.4 6.2-4.4z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-[12.5px] text-text-2 mt-6">
            New to AutoSmokeGuard?{' '}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
