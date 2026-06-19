import { useState } from 'react'
import { Link } from 'react-router-dom'
import { validateEmail } from '../lib/validation'
import AuthHero from '../components/auth/AuthHero'

const inputCls = (hasError) =>
  `h-[42px] w-full border rounded-[9px] bg-surface flex items-center px-[14px] text-[13.5px] text-text font-[inherit] outline-none transition-[border-color] duration-150 placeholder:text-muted ${hasError ? 'border-[#f87171] mb-1.5 focus:border-[#f87171]' : 'border-line-2 mb-[18px] focus:border-line-2 focus:shadow-[0_0_0_2px_rgba(250,250,250,0.06)]'}`

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setPending(true)
    setTimeout(() => {
      setPending(false)
      setSent(true)
    }, 700)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-bg">
      <AuthHero />

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          {!sent ? (
            <>
              <h1 className="text-[24px] font-[660] tracking-[-0.02em]">Reset your password</h1>
              <p className="text-text-2 text-[13.5px] mt-[7px] mb-7">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="forgot-email" className="block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="hamza@transport.gov.pk"
                  className={inputCls(!!error)}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onBlur={() => setError(validateEmail(email))}
                  aria-invalid={!!error}
                />
                {error && <p className="text-[12px] text-[#f87171] mt-1.5 mb-3">{error}</p>}

                <button
                  type="submit"
                  className="btn btn-pri w-full h-[42px] justify-center text-[13.5px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={pending}
                >
                  {pending ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-accent-glow text-accent mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h1 className="text-[24px] font-[660] tracking-[-0.02em]">Check your inbox</h1>
              <p className="text-text-2 text-[13.5px] mt-[7px] mb-7">
                We've sent a password reset link to{' '}
                <span className="font-[550] text-text">{email}</span>.
              </p>

              <p className="text-[13.5px] text-text-2">
                Didn't get it? Check spam or{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => setSent(false)}
                >
                  try again
                </button>
                .
              </p>
            </>
          )}

          <p className="text-center text-[12.5px] text-text-2 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
