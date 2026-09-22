import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// jsdom has no ResizeObserver implementation — Radix primitives (e.g. Slider)
// use it internally, so tests that mount them need this stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(() => {
  localStorage.clear()
})
