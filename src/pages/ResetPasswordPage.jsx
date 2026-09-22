import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { confirmPasswordReset } from '../features/auth/authSlice'
import AuthHero from '../components/auth/AuthHero'
import { validatePassword, validateConfirm } from '../lib/validation'
import { splitServerErrors } from '../lib/formErrors'

const inputCls = (hasError) =>
  `h-[42px] w-full border rounded-[9px] bg-surface flex items-center px-[14px] text-[13.5px] text-text font-[inherit] outline-none transition-[border-color] duration-150 placeholder:text-muted ${hasError ? 'border-[#f87171] mb-1.5 focus:border-[#f87171]' : 'border-line-2 mb-[18px] focus:border-line-2 focus:shadow-[0_0_0_2px_rgba(250,250,250,0.06)]'}`

export default function ResetPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const status = useSelector((state) => state.auth.status)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [inlineError, setInlineError] = useState('')
  const [errors, setErrors] = useState({})

  const isPending = status === 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {
      password: validatePassword(password, true),
      confirm: validateConfirm(password, confirm),
    }
    if (nextErrors.password || nextErrors.confirm) {
      setErrors(nextErrors)
      return
    }
    if (!token) {
      setInlineError('This reset link is invalid or has expired.')
      return
    }
    setErrors({})
    setInlineError('')
    const result = await dispatch(confirmPasswordReset({ token, password }))
    if (confirmPasswordReset.fulfilled.match(result)) {
      navigate('/login', {
        replace: true,
        state: { flash: 'Your password has been reset. Please sign in.' },
      })
    } else {
      const { fieldErrors, inlineError: msg } = splitServerErrors(result.payload, ['password', 'token'])
      setErrors((prev) => ({ ...prev, password: fieldErrors.password || prev.password }))
      setInlineError(fieldErrors.token || msg)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-bg">
      <AuthHero />

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[24px] font-[660] tracking-[-0.02em]">Set a new password</h1>
          <p className="text-text-2 text-[13.5px] mt-[7px] mb-7">
            Choose a new password for your account.
          </p>

          {!token && (
            <p role="alert" className="text-[12px] text-[#f87171] mb-4">
              This link is missing a reset token. Request a new one from the{' '}
              <Link to="/forgot-password" className="link">forgot password</Link> page.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="reset-password" className="block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]">
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              className={inputCls(!!errors.password)}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password, true) }))}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reset-password-error' : undefined}
            />
            {errors.password && <p id="reset-password-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.password}</p>}

            <label htmlFor="reset-confirm" className="block text-[12.5px] font-[560] mb-[7px] text-[#d4d4d4]">
              Confirm new password
            </label>
            <input
              id="reset-confirm"
              type="password"
              className={inputCls(!!errors.confirm)}
              placeholder="••••••••••"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors((prev) => ({ ...prev, confirm: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, confirm: validateConfirm(password, confirm) }))}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined}
            />
            {errors.confirm && <p id="reset-confirm-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.confirm}</p>}

            {inlineError && <p role="alert" className="text-[12px] text-[#f87171] mb-3 -mt-2.5">{inlineError}</p>}

            <button
              type="submit"
              className="btn btn-pri w-full h-[42px] justify-center text-[13.5px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="text-center text-[12.5px] text-text-2 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
