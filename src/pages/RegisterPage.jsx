import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { register } from '../features/auth/authSlice'
import AuthHero from '../components/auth/AuthHero'

const INPUT_CLS =
  'h-[42px] w-full border border-line-2 rounded-[9px] bg-surface flex items-center px-[14px] text-[13.5px] mb-[18px] text-text font-[inherit] outline-none transition-[border-color] duration-150 placeholder:text-muted focus:border-line-2 focus:shadow-[0_0_0_2px_rgba(250,250,250,0.06)]'
const LABEL_CLS = 'block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]'

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
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-bg">
      <AuthHero />

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[24px] font-[660] tracking-[-0.02em]">Create your account</h1>
          <p className="text-text-2 text-[13.5px] mt-[7px] mb-7">Start analyzing vehicle emissions.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="reg-name" className={LABEL_CLS}>Name</label>
            <input
              id="reg-name"
              type="text"
              className={INPUT_CLS}
              placeholder="Hamza Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />

            <label htmlFor="reg-email" className={LABEL_CLS}>Email</label>
            <input
              id="reg-email"
              type="email"
              className={INPUT_CLS}
              placeholder="hamza@transport.gov.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label htmlFor="reg-password" className={LABEL_CLS}>Password</label>
            <input
              id="reg-password"
              type="password"
              className={INPUT_CLS}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <label htmlFor="reg-confirm" className={LABEL_CLS}>Confirm password</label>
            <input
              id="reg-confirm"
              type="password"
              className={INPUT_CLS}
              placeholder="••••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {inlineError && <p className="text-[12px] text-[#f87171] mb-3 -mt-2.5">{inlineError}</p>}

            <button
              type="submit"
              className="btn btn-pri w-full h-[42px] justify-center text-[13.5px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? 'Creating account…' : 'Create account'}
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
            Already have an account?{' '}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
