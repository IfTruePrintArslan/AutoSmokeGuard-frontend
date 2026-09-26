import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  REPORT_STATUS,
  REPORT_STATUS_VALUES,
  reportStatusOf,
  serverIsGeneratingReport,
  serverHasNoReportComing,
} from '../reportStatus'

// `report_status` is a closed vocabulary the server defines and this module
// mirrors by hand, exactly like REPORT_BUDGET_SECONDS next door — and with
// the same failure mode if it drifts: a client that does not recognise the
// word the server sent falls back to the wall-clock guess this field was
// added to replace, silently and with no error anywhere. So the mirror is
// checked against the source of truth rather than trusted.
//
// Finding the backend (it is a *different repository*)
// ----------------------------------------------------
// frontend/ is its own git repo, so a standalone checkout — which is how CI
// clones it, and how the README tells collaborators to work — has no sibling
// backend/ at all. Resolving `../backend/...` and nothing else only ever
// worked because the author's frontend/ happens to sit inside FYP/; on a
// runner it was a hard ENOENT.
//
// Deleting this guard was not an option (it is the only thing that catches
// the server growing a sixth state this client would silently ignore), and
// neither was an unconditional skip, which is green while verifying nothing.
// So the backend is *searched for* in the places it legitimately lives, and
// when it genuinely is not there the test skips with a message that names
// what was missing and how to supply it.
const BACKEND_ENV_VAR = 'ASG_BACKEND_PATH'

/** Every plausible root of the backend repo, most specific first. */
function backendRoots() {
  const override = (process.env[BACKEND_ENV_VAR] ?? '').trim()
  return [
    ...(override ? [resolve(override)] : []),
    resolve(process.cwd(), '_backend'), // sibling checkout made by CI
    resolve(process.cwd(), '../backend'), // umbrella working copy (FYP/)
    resolve(process.cwd(), '../_backend'),
  ]
}

/** The first root that actually contains `relativePath`, or null. */
function findInBackend(relativePath) {
  return backendRoots().map((root) => resolve(root, relativePath)).find(existsSync) ?? null
}

/** An explicit "missing input, not a pass" note for the skip. */
function missingBackendNote(relativePath) {
  return (
    `MISSING INPUT (this is not a pass): backend/${relativePath} was not found, so the ` +
    'report-status drift guard could not run. It lives in the backend repository ' +
    '(IfTruePrintArslan/AutoSmokeGuard-backend), not in this one, so a standalone frontend ' +
    `checkout does not contain it. Looked in: ${backendRoots().join('; ')}. Set ` +
    `${BACKEND_ENV_VAR} to the backend checkout root to make this guard run.`
  )
}

const MODELS_PY_RELATIVE = 'analysis/models.py'

/** `{REPORT_PENDING: 'pending', ...}` as literally written in the model. */
function serverConstants(source) {
  const found = {}
  for (const [, name, value] of source.matchAll(/^(REPORT_[A-Z]+)\s*=\s*'([a-z_]+)'\s*$/gm)) {
    found[name] = value
  }
  return found
}

/** The vocabulary in declaration order, read out of REPORT_STATUS_CHOICES. */
function serverVocabulary(source) {
  const block = source.match(/^REPORT_STATUS_CHOICES\s*=\s*\(([\s\S]*?)^\)/m)
  expect(block, 'REPORT_STATUS_CHOICES is no longer a plain tuple in backend/analysis/models.py').toBeTruthy()
  const constants = serverConstants(source)
  return [...block[1].matchAll(/\(\s*(REPORT_[A-Z]+)\s*,/g)].map(([, name]) => constants[name])
}

describe('report status — parity with the server', () => {
  it('mirrors backend REPORT_STATUS_CHOICES exactly', (ctx) => {
    const MODELS_PY = findInBackend(MODELS_PY_RELATIVE)
    ctx.skip(MODELS_PY === null, missingBackendNote(MODELS_PY_RELATIVE))

    const vocabulary = serverVocabulary(readFileSync(MODELS_PY, 'utf-8'))

    expect(vocabulary.length).toBeGreaterThan(0)
    expect(
      [...vocabulary].sort(),
      'backend REPORT_STATUS_CHOICES and frontend REPORT_STATUS have drifted apart — ' +
        'a value the client does not recognise is a value it silently ignores, which puts ' +
        'the results screen back on guessing whether a report is still coming'
    ).toEqual([...REPORT_STATUS_VALUES].sort())
  })

  it('agrees with the server on the two values that end the wait', (ctx) => {
    // These are the states the whole feature turns on: the client stops
    // waiting early only because the server said one of them.
    const MODELS_PY = findInBackend(MODELS_PY_RELATIVE)
    ctx.skip(MODELS_PY === null, missingBackendNote(MODELS_PY_RELATIVE))

    const vocabulary = serverVocabulary(readFileSync(MODELS_PY, 'utf-8'))
    expect(vocabulary).toContain(REPORT_STATUS.FAILED)
    expect(vocabulary).toContain(REPORT_STATUS.SKIPPED)
  })
})

describe('reportStatusOf', () => {
  it('reads a recognised value off the detail payload', () => {
    for (const value of REPORT_STATUS_VALUES) {
      expect(reportStatusOf({ report_status: value })).toBe(value)
    }
  })

  // No-change guard (passes with and without this feature, by design): it
  // pins the fallback the whole design depends on, namely that a payload
  // carrying no usable signal leaves the client exactly where it was.
  it('reports "no signal" for a server that does not send the field', () => {
    expect(reportStatusOf({})).toBeNull()
    expect(reportStatusOf(null)).toBeNull()
    expect(reportStatusOf(undefined)).toBeNull()
    expect(reportStatusOf({ report_status: null })).toBeNull()
  })

  it('reports "no signal" for a word this build has never heard of', () => {
    // Forward compatibility: a newer server adding a sixth state must make
    // this client fall back to the time budget, not guess at the meaning.
    expect(reportStatusOf({ report_status: 'queued_behind_others' })).toBeNull()
    expect(reportStatusOf({ report_status: 'READY' })).toBeNull()
    expect(reportStatusOf({ report_status: 42 })).toBeNull()
  })
})

describe('serverIsGeneratingReport', () => {
  it('is true only while the server says a render is in flight', () => {
    expect(serverIsGeneratingReport(REPORT_STATUS.GENERATING)).toBe(true)
  })

  it('does not treat "pending" as work in flight', () => {
    // 'pending' is the state a run sits in between finishing and its report
    // hook firing — including runs that will never produce a PDF at all.
    // Reading it as "in flight" would flash a promise the server never made.
    expect(serverIsGeneratingReport(REPORT_STATUS.PENDING)).toBe(false)
  })

  it('is false for every other value and for no signal', () => {
    for (const value of [REPORT_STATUS.READY, REPORT_STATUS.FAILED, REPORT_STATUS.SKIPPED, null]) {
      expect(serverIsGeneratingReport(value)).toBe(false)
    }
  })
})

describe('serverHasNoReportComing', () => {
  it('is true for the two states that mean nothing more is coming', () => {
    expect(serverHasNoReportComing(REPORT_STATUS.FAILED)).toBe(true)
    expect(serverHasNoReportComing(REPORT_STATUS.SKIPPED)).toBe(true)
  })

  it('is false while the server may still deliver, and when it said nothing', () => {
    for (const value of [REPORT_STATUS.PENDING, REPORT_STATUS.GENERATING, REPORT_STATUS.READY, null]) {
      expect(serverHasNoReportComing(value)).toBe(false)
    }
  })
})
