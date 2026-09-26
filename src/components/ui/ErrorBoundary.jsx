import { Component } from 'react'

/**
 * Last line of defence against a render-time throw.
 *
 * React unmounts the *entire* tree when a render throws with no boundary
 * above it, so one bad value anywhere — a `metrics.json` field that came
 * back as a string where a number was expected, say — white-screens every
 * route, not just the page that touched it. This catches that and renders a
 * readable panel instead.
 *
 * It is a safety net, not a substitute for guarding the unsafe render:
 * whatever it catches is still a bug.
 *
 * @param {React.ReactNode} children
 * @param {string} [title]
 * @param {string} [description]
 * @param {*} [resetKey]  when this changes, a caught error is cleared and the
 *   children are re-rendered — pass the route path so navigating away from a
 *   crashed page brings it back to life instead of pinning the panel there.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // No telemetry sink in this build — the console is the only trail a
    // developer or a support session has, so make sure the component stack
    // survives alongside the error.
    console.error('[ErrorBoundary] render failed', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  handleReload() {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const {
      title = 'Something went wrong',
      description = 'This screen hit an unexpected error and could not be displayed. Your data is safe — reloading usually clears it.',
    } = this.props

    const message = error?.message || String(error)
    const stack = error?.stack || ''

    return (
      <div
        role="alert"
        className="flex items-center justify-center w-full min-h-[320px] py-14 px-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="card w-full max-w-[520px] p-6 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-full bg-high-bg text-high flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          <p className="text-[12.5px] text-text-2 mt-1.5 max-w-[420px] leading-relaxed">{description}</p>

          <details className="w-full mt-5 text-left">
            <summary className="text-[12px] text-text-2 cursor-pointer select-none">
              Error details
            </summary>
            <pre className="mt-2 max-h-[180px] overflow-auto rounded-[9px] border border-line bg-bg-2 p-3 text-[11.5px] leading-relaxed text-text-2 whitespace-pre-wrap break-words">
              {/* The message is printed on its own line rather than relying
                  on `stack` to embed it — not every engine puts it there. */}
              {message}
              {stack ? `\n\n${stack}` : ''}
            </pre>
          </details>

          <div className="flex items-center gap-2.5 mt-5">
            <button type="button" className="btn btn-pri" onClick={this.handleReload}>
              Reload
            </button>
            {/* A full document load, deliberately: the React tree that threw
                cannot be trusted to route out of its own failure. */}
            <a className="btn btn-ghost" href="/dashboard">
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }
}
