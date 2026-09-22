import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { register } from '../features/auth/authSlice'
import AuthHero from '../components/auth/AuthHero'
import { validateName, validateEmail, validatePassword, validateConfirm } from '../lib/validation'
import { splitServerErrors } from '../lib/formErrors'

const inputCls = (hasError) =>
  `h-[42px] w-full border rounded-[9px] bg-surface flex items-center px-[14px] text-[13.5px] text-text font-[inherit] outline-none transition-[border-color] duration-150 placeholder:text-muted ${hasError ? 'border-[#f87171] mb-1.5 focus:border-[#f87171]' : 'border-line-2 mb-[18px] focus:border-line-2 focus:shadow-[0_0_0_2px_rgba(250,250,250,0.06)]'}`

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
  const [errors, setErrors] = useState({})

  const isPending = status === 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password, true),
      confirm: validateConfirm(password, confirm),
    }
    if (nextErrors.name || nextErrors.email || nextErrors.password || nextErrors.confirm) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setInlineError('')
    const result = await dispatch(register({ full_name: name.trim(), email: email.trim(), password }))
    if (register.fulfilled.match(result)) {
      navigate('/dashboard')
    } else {
      const { fieldErrors, inlineError: msg } = splitServerErrors(
        result.payload,
        ['full_name', 'email', 'password'],
        'Too many sign-up attempts. Please wait about a minute and try again.'
      )
      // The backend's `full_name` field maps to this form's `name` input.
      if (fieldErrors.full_name) {
        fieldErrors.name = fieldErrors.full_name
        delete fieldErrors.full_name
      }
      setErrors((prev) => ({ ...prev, ...fieldErrors }))
      setInlineError(msg)
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
              className={inputCls(!!errors.name)}
              placeholder="Hamza Khan"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, name: validateName(name) }))}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'reg-name-error' : undefined}
            />
            {errors.name && <p id="reg-name-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.name}</p>}

            <label htmlFor="reg-email" className={LABEL_CLS}>Email</label>
            <input
              id="reg-email"
              type="email"
              className={inputCls(!!errors.email)}
              placeholder="hamza@transport.gov.pk"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'reg-email-error' : undefined}
            />
            {errors.email && <p id="reg-email-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.email}</p>}

            <label htmlFor="reg-password" className={LABEL_CLS}>Password</label>
            <input
              id="reg-password"
              type="password"
              className={inputCls(!!errors.password)}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password, true) }))}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reg-password-error' : undefined}
            />
            {errors.password && <p id="reg-password-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.password}</p>}

            <label htmlFor="reg-confirm" className={LABEL_CLS}>Confirm password</label>
            <input
              id="reg-confirm"
              type="password"
              className={inputCls(!!errors.confirm)}
              placeholder="••••••••••"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors((prev) => ({ ...prev, confirm: '' })) }}
              onBlur={() => setErrors((prev) => ({ ...prev, confirm: validateConfirm(password, confirm) }))}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'reg-confirm-error' : undefined}
            />
            {errors.confirm && <p id="reg-confirm-error" role="alert" className="text-[12px] text-[#f87171] mt-1.5 mb-3">{errors.confirm}</p>}

            {inlineError && <p role="alert" className="text-[12px] text-[#f87171] mb-3 -mt-2.5">{inlineError}</p>}

            <button
              type="submit"
              className="btn btn-pri w-full h-[42px] justify-center text-[13.5px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

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
