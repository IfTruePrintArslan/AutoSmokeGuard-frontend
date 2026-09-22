import { describe, it, expect } from 'vitest'
import { isThrottled, splitServerErrors } from '../formErrors'

describe('isThrottled', () => {
  it('is true for DRF\'s throttled code', () => {
    expect(isThrottled({ code: 'throttled', detail: 'Request was throttled. Expected available in 43 seconds.' })).toBe(true)
  })

  it('is true for a bare HTTP 429 status even without the code', () => {
    expect(isThrottled({ status: 429, detail: 'Request was throttled. Expected available in 12 seconds.' })).toBe(true)
  })

  it('is false for any other error', () => {
    expect(isThrottled({ code: 'invalid_credentials', status: 401, detail: 'Invalid credentials.' })).toBe(false)
    expect(isThrottled(null)).toBe(false)
    expect(isThrottled(undefined)).toBe(false)
  })
})

describe('splitServerErrors — throttled requests', () => {
  const rawThrottlePayload = {
    detail: 'Request was throttled. Expected available in 43 seconds.',
    code: 'throttled',
    errors: {},
  }

  it('never surfaces DRF\'s raw wording — detected structurally, not by string-matching', () => {
    const { inlineError, fieldErrors } = splitServerErrors(rawThrottlePayload, ['email', 'password'])

    expect(inlineError).not.toMatch(/Expected available in/i)
    expect(inlineError).not.toMatch(/throttled/i)
    expect(fieldErrors).toEqual({})
  })

  it('falls back to the shared default message when no override is given', () => {
    const { inlineError } = splitServerErrors(rawThrottlePayload, ['email', 'password'])
    expect(inlineError).toBe('Too many attempts. Please wait about a minute and try again.')
  })

  it('uses a caller-supplied contextual message (e.g. login) when given one', () => {
    const { inlineError } = splitServerErrors(
      rawThrottlePayload,
      ['email', 'password'],
      'Too many sign-in attempts. Please wait about a minute and try again.'
    )
    expect(inlineError).toBe('Too many sign-in attempts. Please wait about a minute and try again.')
  })

  it('still detects throttling purely from a 429 status, with no `code` present', () => {
    const { inlineError } = splitServerErrors(
      { detail: 'Request was throttled. Expected available in 5 seconds.', status: 429 },
      ['email']
    )
    expect(inlineError).toBe('Too many attempts. Please wait about a minute and try again.')
  })

  it('does not apply throttle handling to an ordinary rejection', () => {
    // `errors` here is already flattened to { field: message }, matching
    // what `ApiError.fieldErrors` (see lib/api.js) hands to this function
    // in real usage — not DRF's raw { field: [messages] } shape.
    const { inlineError, fieldErrors } = splitServerErrors(
      { detail: 'Invalid credentials.', code: 'invalid_credentials', errors: { password: 'Incorrect password.' } },
      ['email', 'password']
    )
    expect(fieldErrors.password).toBe('Incorrect password.')
    expect(inlineError).toBe('')
  })
})
