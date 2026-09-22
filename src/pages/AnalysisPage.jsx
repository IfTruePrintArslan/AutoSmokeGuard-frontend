import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import usePolling from '../hooks/usePolling'
import {
  pollStatus,
  fetchAnalysis,
  generateReport,
  startAnalysis,
} from '../features/analysis/analysisSlice'
import { fetchHistory } from '../features/history/historySlice'
import { pushToast } from '../features/ui/uiSlice'
import SeverityDistribution from '../components/SeverityDistribution'
import SeverityBadge from '../components/ui/SeverityBadge'
import Spinner from '../components/ui/Spinner'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { apiDownload, mediaUrl } from '../lib/api'
import { severityCountsToDistribution } from '../lib/severity'

const TERMINAL_STATUSES = new Set(['done', 'failed'])

function fmtSeconds(sec) {
  if (sec === null || sec === undefined) return '—'
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/* ───────────────────────── Elapsed timer ───────────────────────── */
function useElapsed(startedAt, active) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active || !startedAt) return undefined
    const start = new Date(startedAt).getTime()
    if (Number.isNaN(start)) return undefined
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, active])
  return elapsed
}

/* ───────────────────────── Frame lightbox ───────────────────────── */
function FrameLightbox({ frames, index, setIndex, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, frames.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [frames.length, setIndex, onClose])

  if (!frames.length) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Annotated frame viewer">
      <div className="absolute inset-0 bg-black/85" aria-hidden="true" onClick={onClose} />
      <div className="relative max-w-[min(90vw,900px)] max-h-[85vh] flex flex-col items-center gap-3">
        <img
          src={mediaUrl(frames[index])}
          alt={`Annotated frame ${index + 1} of ${frames.length}`}
          className="max-h-[75vh] max-w-full rounded-[10px] border border-line-2 object-contain"
        />
        <div className="flex items-center gap-4 text-[12.5px] text-text-2">
          <button
            type="button"
            aria-label="Previous frame"
            className="btn btn-ghost h-8 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          >
            ←
          </button>
          <span className="mono">{index + 1} / {frames.length}</span>
          <button
            type="button"
            aria-label="Next frame"
            className="btn btn-ghost h-8 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={index === frames.length - 1}
            onClick={() => setIndex((i) => Math.min(i + 1, frames.length - 1))}
          >
            →
          </button>
          <button type="button" className="btn btn-ghost h-8 px-3" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ───────────────────────── Index (list) view ───────────────────────── */
function AnalysisIndexView() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { items, status, error } = useSelector((s) => s.history)
  const polling = useSelector((s) => s.analysis.polling)

  const load = useCallback(() => {
    dispatch(fetchHistory({ page: 1, page_size: 20, ordering: '-created_at' }))
  }, [dispatch])

  useEffect(() => {
    load()
  }, [load])

  const inFlight = Object.values(polling).filter((j) => !TERMINAL_STATUSES.has(j.status))

  return (
    <div className="flex flex-col">
      <div className="page-head">
        <div>
          <h1>Live Analysis</h1>
          <p>Monitor in-progress jobs and jump into recent results.</p>
        </div>
      </div>

      {status === 'pending' && !items.length ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : status === 'rejected' && !items.length ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items.length && !inFlight.length ? (
        <EmptyState
          title="No analyses yet"
          description="Upload traffic footage or stills to run your first smoke detection analysis."
          action={
            <button type="button" className="btn btn-pri" onClick={() => navigate('/upload')}>
              Upload media
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {inFlight.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>In progress</h3>
                <span className="sev" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                  <i style={{ background: 'var(--accent)' }} />
                  {inFlight.length} active
                </span>
              </div>
              <div className="py-3.5 px-[18px] flex flex-col gap-4">
                {inFlight.map((job) => (
                  <button
                    key={job.job_id}
                    type="button"
                    className="text-left w-full bg-transparent border-none p-0 cursor-pointer"
                    onClick={() => navigate(`/analysis/${job.analysis_id}`)}
                  >
                    <div className="flex justify-between text-[13px]">
                      <b className="font-[550]">{job.stage || 'Processing'}</b>
                      <span className="mono text-accent font-semibold text-[12px]">{job.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden">
                      <i className="block h-full rounded-[99px] bg-[#e5e5e5]" style={{ width: `${job.progress ?? 0}%` }} />
                    </div>
                    <div className="text-[11.5px] text-muted">Status: {job.status}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-head">
                <h3>Recent analyses</h3>
              </div>
              <div className="overflow-x-auto">
                <table>
                  <tbody>
                    <tr>
                      <th>Source</th>
                      <th>Vehicles</th>
                      <th>Confidence</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                    {items.map((row) => (
                      <tr key={row.analysis_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="thumb" />
                            <div className="text-[13px] font-[550] truncate max-w-[220px]">{row.media?.filename}</div>
                          </div>
                        </td>
                        <td className="mono">{row.total_vehicles ?? '—'}</td>
                        <td className="mono">{row.avg_confidence != null ? row.avg_confidence.toFixed(2) : '—'}</td>
                        <td>{row.overall_severity ? <SeverityBadge severity={row.overall_severity} /> : '—'}</td>
                        <td className="capitalize">{row.status}</td>
                        <td><Link className="link" to={`/analysis/${row.analysis_id}`}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Detail view ───────────────────────── */
function AnalysisDetailView({ analysisId }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [rerunning, setRerunning] = useState(false)

  const detailById = useSelector((s) => s.analysis.detail.byId)
  const detailStatus = useSelector((s) => s.analysis.detail.status)
  const detailError = useSelector((s) => s.analysis.detail.error)
  const pollingMap = useSelector((s) => s.analysis.polling)
  const settings = useSelector((s) => s.analysis.settings)

  const detail = detailById[analysisId]

  // `job_id` and `analysis_id` are always equal (see API_CONTRACT.md,
  // "Analysis" section) and either may be passed to GET /api/status/{...},
  // so the analysis id is polled against /api/status directly here in
  // every case — a cold page load, a History link, or a refresh all still
  // get a populated `stage`, not just the bare status/progress pair
  // GET /api/analysis/{id} carries.
  const job = pollingMap[analysisId] || null
  const liveStatus = job?.status || detail?.status
  const isTerminal = liveStatus ? TERMINAL_STATUSES.has(liveStatus) : false
  const isRunning = liveStatus && !isTerminal

  usePolling(pollStatus, isTerminal ? null : analysisId, {
    isDone: (result) => TERMINAL_STATUSES.has(result?.payload?.status),
  })

  // Full detail: fetched once up front so the media/filename render even
  // while still running, and again whenever the polled status flips
  // terminal so the final vehicles/report/etc. land.
  useEffect(() => {
    dispatch(fetchAnalysis(analysisId))
  }, [dispatch, analysisId])

  useEffect(() => {
    if (job && isTerminal) {
      dispatch(fetchAnalysis(analysisId))
    }
  }, [dispatch, analysisId, job, isTerminal])

  const startedAt = job?.started_at || detail?.start_time || detail?.created_at
  const elapsed = useElapsed(startedAt, isRunning)

  const handleGenerateReport = async () => {
    setGenerating(true)
    const result = await dispatch(generateReport(analysisId))
    setGenerating(false)
    if (!generateReport.fulfilled.match(result)) {
      dispatch(pushToast({ message: result.payload?.detail || 'Failed to generate report.', variant: 'error' }))
    }
  }

  const handleDownload = async () => {
    if (!detail?.report?.report_id) return
    try {
      await apiDownload(`/api/download-report/${detail.report.report_id}`, `${detail.media?.filename || 'report'}.pdf`)
    } catch {
      dispatch(pushToast({ message: 'Failed to download report.', variant: 'error' }))
    }
  }

  const handleRunAgain = async () => {
    if (!detail?.media?.media_id) return
    setRerunning(true)
    const result = await dispatch(startAnalysis({ media_id: detail.media.media_id, settings }))
    setRerunning(false)
    if (startAnalysis.fulfilled.match(result)) {
      navigate(`/analysis/${result.payload.analysis_id}`)
    } else {
      dispatch(pushToast({ message: result.payload?.detail || 'Failed to start analysis.', variant: 'error' }))
    }
  }

  /* ── Loading (nothing cached yet) ── */
  if (!detail && detailStatus === 'pending') {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[220px] w-full" />
        <Skeleton className="h-[120px] w-full" />
      </div>
    )
  }

  /* ── Error (nothing cached yet) ── */
  if (!detail && detailStatus === 'rejected') {
    return <ErrorState message={detailError} onRetry={() => dispatch(fetchAnalysis(analysisId))} />
  }

  if (!detail) {
    return <EmptyState title="Analysis not found" description="This analysis may have been deleted." />
  }

  const progress = job?.progress ?? detail.progress ?? 0
  const stage = job?.stage || 'Processing'

  /* ── Running / queued ── */
  if (isRunning) {
    return (
      <div className="flex flex-col gap-4">
        <div className="card p-6 flex flex-col items-center text-center">
          <div className="thumb mb-4" style={{ width: 72, height: 48 }} />
          <h2 className="text-[15px] font-semibold">{detail.media?.filename}</h2>
          <p className="text-[12.5px] text-text-2 mt-1">{stage}…</p>

          <div className="w-full max-w-[420px] mt-6">
            <div
              className="h-2.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Analysis progress"
            >
              <i className="block h-full rounded-[99px] bg-[#fafafa] transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[12px] text-text-2 mt-2">
              <span className="mono">{progress}%</span>
              <span className="mono">{fmtSeconds(elapsed)} elapsed</span>
            </div>
          </div>

          <p className="text-[11.5px] text-muted mt-6 max-w-[340px]">
            This runs in the background — you can leave this page and come back later, the analysis keeps processing.
          </p>
        </div>
      </div>
    )
  }

  /* ── Failed ── */
  if (liveStatus === 'failed') {
    return (
      <div className="card p-6 flex flex-col items-center text-center">
        <div className="w-11 h-11 rounded-full bg-high-bg text-high flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-[15px] font-semibold">Analysis failed</h2>
        <p className="text-[12.5px] text-text-2 mt-1.5 max-w-[420px]">
          {job?.error_message || detail.error_message || 'An unexpected error occurred while processing this media.'}
        </p>
        <button type="button" className="btn btn-pri mt-5" disabled={rerunning} onClick={handleRunAgain}>
          {rerunning && <Spinner size={14} />}
          {rerunning ? 'Starting…' : 'Run again'}
        </button>
      </div>
    )
  }

  /* ── Done — results view ── */
  const vehicles = detail.vehicles || []
  const smokeCount = vehicles.filter((v) => v.smoke).length
  const severityData = severityCountsToDistribution(detail.severity_counts)
  const severityTotal = severityData.reduce((sum, e) => sum + e.value, 0)
  const frames = detail.annotated_frames || []

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <div>
            <h3>{detail.media?.filename}</h3>
            <div className="sub">Analyzed {fmtDate(detail.end_time || detail.created_at)}</div>
          </div>
          <div className="flex gap-2">
            {detail.report?.report_id ? (
              <button type="button" className="btn btn-pri" onClick={handleDownload}>
                Download PDF
              </button>
            ) : (
              <button type="button" className="btn btn-pri" disabled={generating} onClick={handleGenerateReport}>
                {generating && <Spinner size={14} />}
                {generating ? 'Generating…' : 'Generate PDF report'}
              </button>
            )}
          </div>
        </div>
        <div className="p-[18px]">
          {detail.preview_url ? (
            <button
              type="button"
              className="block w-full p-0 border-none bg-transparent cursor-zoom-in"
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true) }}
              disabled={!frames.length}
              aria-label="Open annotated frame viewer"
            >
              <img
                src={mediaUrl(detail.preview_url)}
                alt={`Annotated preview of ${detail.media?.filename}`}
                className="w-full max-h-[420px] object-contain rounded-[10px] border border-line-2 bg-bg-2"
              />
            </button>
          ) : (
            <div className="thumb w-full h-[220px]" style={{ width: '100%', height: 220 }} />
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          ['Vehicles detected', detail.total_vehicles ?? 0],
          ['Smoke regions', detail.total_smoke ?? smokeCount],
          ['Avg. confidence', detail.avg_confidence != null ? detail.avg_confidence.toFixed(2) : '—'],
          ['Frames processed', detail.frames_processed ?? '—'],
          ['Duration', detail.duration_seconds != null ? `${detail.duration_seconds.toFixed(1)}s` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="card py-4 px-[18px]">
            <div className="text-[12px] text-text-2">{label}</div>
            <div className="mono text-[20px] font-[650] tracking-[-0.02em] mt-1.5">{value}</div>
          </div>
        ))}
        <div className="card py-4 px-[18px] flex flex-col justify-between">
          <div className="text-[12px] text-text-2">Overall severity</div>
          <div className="mt-1.5">
            <SeverityBadge severity={detail.overall_severity} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-stretch">
        {/* Detections table */}
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3>Detections</h3>
            <span className="sub">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            {vehicles.length === 0 ? (
              <EmptyState title="No vehicles detected" description="This analysis did not find any vehicles in the media." />
            ) : (
              <table>
                <tbody>
                  <tr>
                    <th>Vehicle</th>
                    <th>Frame</th>
                    <th>Timestamp</th>
                    <th>Confidence</th>
                    <th>Severity</th>
                    <th>Intensity</th>
                  </tr>
                  {vehicles.map((v) => (
                    <tr key={v.vehicle_id}>
                      <td className="capitalize">{v.vehicle_type}</td>
                      <td className="mono">{v.frame_number}</td>
                      <td className="mono">{v.timestamp_seconds != null ? `${v.timestamp_seconds.toFixed(1)}s` : '—'}</td>
                      <td className="mono">{v.confidence != null ? v.confidence.toFixed(2) : '—'}</td>
                      <td>{v.smoke ? <SeverityBadge severity={v.smoke.severity} /> : '—'}</td>
                      <td className="mono">{v.smoke?.intensity != null ? v.smoke.intensity.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <SeverityDistribution
          data={severityData}
          total={severityTotal}
          title="Severity breakdown"
          subtitle="This analysis"
          unitLabel="vehicles"
        />
      </div>

      {lightboxOpen && (
        <FrameLightbox
          frames={frames}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

/* ───────────────────────── Route entry point ───────────────────────── */
export default function AnalysisPage() {
  const { analysisId } = useParams()

  if (!analysisId) return <AnalysisIndexView />

  return (
    <div className="flex flex-col">
      <div className="page-head">
        <div>
          <h1>Analysis</h1>
          <p>Live progress and detection results.</p>
        </div>
        <Link className="link" to="/analysis">← All analyses</Link>
      </div>
      <AnalysisDetailView analysisId={analysisId} />
    </div>
  )
}
