// Splits a rejected-thunk payload ({ detail, code, errors }) into field-level
// errors that match a form's known field names and a leftover inline message
// for anything the form doesn't render a dedicated slot for.
export function splitServerErrors(payload, knownFields = []) {
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
