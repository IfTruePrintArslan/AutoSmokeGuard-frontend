// DRF's rate limiting raises a `Throttled` exception with `code: "throttled"`
// and HTTP 429, and renders it as a raw, framework-flavoured string — e.g.
// "Request was throttled. Expected available in 43 seconds." That is
// internal wording, not something to show a user. Detected structurally
// (the code / status the API envelope carries), never by matching that
// string, so it keeps working if the wait-time phrasing ever changes.
const DEFAULT_THROTTLE_MESSAGE = 'Too many attempts. Please wait about a minute and try again.'

export function isThrottled(payload) {
  return payload?.code === 'throttled' || payload?.status === 429
}

// Splits a rejected-thunk payload ({ detail, code, status, errors }) into
// field-level errors that match a form's known field names and a leftover
// inline message for anything the form doesn't render a dedicated slot for.
export function splitServerErrors(payload, knownFields = [], throttleMessage = DEFAULT_THROTTLE_MESSAGE) {
  if (isThrottled(payload)) {
    return { fieldErrors: {}, inlineError: throttleMessage }
  }

  const errors = payload?.errors || {}
  const fieldErrors = {}
  const leftoverMessages = []

  for (const [field, message] of Object.entries(errors)) {
    if (knownFields.includes(field)) {
      fieldErrors[field] = message
    } else {
      leftoverMessages.push(message)
    }
  }

  let inlineError = ''
  if (leftoverMessages.length) {
    inlineError = leftoverMessages.join(' ')
  } else if (Object.keys(fieldErrors).length === 0) {
    inlineError = payload?.detail || 'Something went wrong.'
  }

  return { fieldErrors, inlineError }
}
