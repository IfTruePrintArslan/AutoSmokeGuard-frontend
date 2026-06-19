export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(v) {
  const s = (v || '').trim()
  if (!s) return 'Email is required.'
  if (!EMAIL_RE.test(s)) return 'Enter a valid email address.'
  return ''
}

export function validateName(v) {
  const s = (v || '').trim()
  if (!s) return 'Name is required.'
  if (s.length < 2) return 'Name must be at least 2 characters.'
  return ''
}

// strong=true (register): require >=8 chars with at least one letter and one number.
// strong=false (login): just required.
export function validatePassword(v, strong = false) {
  const s = v || ''
  if (!s) return 'Password is required.'
  if (strong) {
    if (s.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return 'Password must include a letter and a number.'
  }
  return ''
}

export function validateConfirm(pw, confirm) {
  if (!confirm) return 'Please confirm your password.'
  if (pw !== confirm) return 'Passwords do not match.'
  return ''
}
