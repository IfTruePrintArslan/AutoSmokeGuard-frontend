import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
} from 'recharts'
import SeverityDistribution from '../components/SeverityDistribution'
import UploadQueue from '../components/UploadQueue'
import SeverityBadge from '../components/ui/SeverityBadge'
import Skeleton from '../components/ui/Skeleton'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import usePolling from '../hooks/usePolling'
import { fetchStats } from '../features/dashboard/dashboardSlice'

const TERMINAL_STATUSES = new Set(['done', 'failed'])

/* ── Custom tooltip ── */
function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const det = payload.find((p) => p.dataKey === 'detections')
  const hi = payload.find((p) => p.dataKey === 'high')
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid #2e2e2e',
        borderRadius: '8px',
        padding: '8px 10px',
        fontFamily: 'var(--font)',
        minWidth: '130px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600, marginBottom: '5px' }}>
        {label}
      </div>
      {det && (
        <div style={{ fontSize: '12px', color: '#ededed' }}>
          {det.value} detections
        </div>
      )}
      {hi && (
        <div style={{ fontSize: '12px', color: '#f87171' }}>
          {hi.value} high
        </div>
      )}
    </div>
  )
}

function toSpark(values) {
  return (values || []).map((v) => ({ v }))
}

function DeltaBadge({ pct, invertGood = false }) {
  if (pct === null || pct === undefined) return null
  const isIncrease = pct >= 0
  const isGood = invertGood ? !isIncrease : isIncrease
  return (
    <span className={`text-[11px] font-semibold py-0.5 px-[7px] rounded-[99px] ${isGood ? 'text-low bg-low-bg' : 'text-high bg-high-bg'}`}>
      {isIncrease ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, deltaPct, spark, strokeColor, invertGood }) {
  return (
    <div className="card py-4 px-[18px]">
      <div className="flex justify-between text-[12.5px] text-text-2">
        <span>{label}</span>
        <DeltaBadge pct={deltaPct} invertGood={invertGood} />
      </div>
      <div className="flex items-end justify-between mt-2.5">
        <div className="mono text-[27px] font-[650] tracking-[-0.03em]">{value}</div>
        <ResponsiveContainer width={92} height={34}>
          <LineChart data={spark}>
            <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke={strokeColor} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  const { data, status, error } = useSelector((s) => s.dashboard)

  // Refreshes stats on an interval; stops backing off once nothing in the
  // processing queue is still active, resumes automatically next mount.
  usePolling(fetchStats, 30, {
    isDone: (result) => {
      const queue = result?.payload?.processing_queue
      if (!Array.isArray(queue)) return true
      return queue.every((item) => TERMINAL_STATUSES.has(item.status))
    },
  })

  if (status === 'pending' && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
        </div>
        <Skeleton className="h-[340px]" />
      </div>
    )
  }

  if (status === 'rejected' && !data) {
    return <ErrorState message={error} onRetry={() => dispatch(fetchStats(30))} />
  }

  if (!data) return null

  const { totals, sparklines, detections_over_time, severity_distribution, recent_analyses, processing_queue } = data
  const isBrandNew = (totals?.analyses ?? 0) === 0 && (recent_analyses?.length ?? 0) === 0

  const severityTotal = (severity_distribution || []).reduce((sum, e) => sum + e.value, 0)
  const activeQueueCount = (processing_queue || []).filter((i) => !TERMINAL_STATUSES.has(i.status)).length

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1>Good afternoon, {firstName}</h1>
          <p>Here is what AutoSmokeGuard detected across your cameras today.</p>
        </div>
      </div>

      {isBrandNew ? (
        <EmptyState
          title="Welcome to AutoSmokeGuard"
          description="You haven't run any analyses yet. Upload traffic footage or stills to detect vehicle smoke emissions and see your stats here."
          action={<button type="button" className="btn btn-pri" onClick={() => navigate('/upload')}>Upload your first media</button>}
        />
      ) : (
        <>
          {/* ── KPI stat cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <KpiCard
              label="Total analyses"
              value={totals.analyses}
              deltaPct={totals.analyses_delta_pct}
              spark={toSpark(sparklines?.analyses)}
              strokeColor="#fafafa"
            />
            <KpiCard
              label="High severity"
              value={totals.high_severity}
              deltaPct={totals.high_delta_pct}
              spark={toSpark(sparklines?.high)}
              strokeColor="#f87171"
              invertGood
            />
            <KpiCard
              label="Reports issued"
              value={totals.reports}
              deltaPct={totals.reports_delta_pct}
              spark={toSpark(sparklines?.reports)}
              strokeColor="#fafafa"
            />
            <KpiCard
              label="Avg. confidence"
              value={totals.avg_confidence != null ? totals.avg_confidence.toFixed(2) : '—'}
              deltaPct={totals.confidence_delta_pct}
              spark={toSpark(sparklines?.confidence)}
              strokeColor="#a3a3a3"
            />
          </div>

          {/* ── Row 2: line chart + donut chart ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 mb-4 items-stretch">
            {/* Detections over time */}
            <div className="card flex flex-col">
              <div className="card-head">
                <div>
                  <h3>Detections over time</h3>
                  <div className="sub">Vehicles flagged per day</div>
                </div>
              </div>
              <div className="w-[calc(100%-36px)] h-[300px] mt-3.5 mx-[18px]">
                {(detections_over_time || []).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[12.5px] text-muted">No detections in this range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={detections_over_time} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="detGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fafafa" stopOpacity={0.10} />
                          <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#232323" />
                      <XAxis dataKey="label" hide />
                      <YAxis hide />
                      <Tooltip content={<CustomLineTooltip />} cursor={{ stroke: '#2e2e2e' }} />
                      <Area
                        type="monotone"
                        dataKey="detections"
                        stroke="#fafafa"
                        strokeWidth={2}
                        fill="url(#detGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#fafafa', stroke: '#0a0a0a', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        stroke="#f87171"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        activeDot={{ r: 3, fill: '#f87171', stroke: '#0a0a0a', strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex gap-[18px] pt-2.5 pb-3.5 px-[18px] text-[12px] text-text-2">
                <span><i className="inline-block w-2 h-2 rounded-[2px] mr-[7px]" style={{ background: '#fafafa' }}></i>All detections</span>
                <span><i className="inline-block w-2 h-2 rounded-[2px] mr-[7px]" style={{ background: '#f87171' }}></i>High severity</span>
              </div>
            </div>

            {/* Severity distribution donut */}
            <div className="h-[320px] xl:h-full">
              <SeverityDistribution data={severity_distribution} total={severityTotal} className="h-full" />
            </div>
          </div>

          {/* ── Row 3: recent analyses table + upload queue + processing queue ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)_minmax(0,300px)] gap-4 items-stretch">
            {/* Recent analyses */}
            <div className="card md:col-span-2 xl:col-span-1 overflow-hidden">
              <div className="card-head">
                <h3>Recent analyses</h3>
                <Link className="link" to="/history">View all →</Link>
              </div>
              <div className="overflow-x-auto">
                {(recent_analyses || []).length === 0 ? (
                  <div className="p-[18px] text-[12.5px] text-muted">No recent analyses.</div>
                ) : (
                  <table style={{ marginTop: '8px' }}>
                    <tbody>
                      <tr>
                        <th>Source</th>
                        <th>Vehicles</th>
                        <th>Confidence</th>
                        <th>Severity</th>
                        <th></th>
                      </tr>
                      {recent_analyses.map((row) => (
                        <tr key={row.analysis_id}>
                          <td><div className="thumb"></div></td>
                          <td>
                            <b style={{ fontWeight: 560 }}>{row.total_vehicles ?? 0}</b>
                            <div className="text-[11.5px] text-muted mt-0.5 truncate max-w-[160px]">{row.media?.filename}</div>
                          </td>
                          <td className="mono">{row.avg_confidence != null ? row.avg_confidence.toFixed(2) : '—'}</td>
                          <td>{row.overall_severity ? <SeverityBadge severity={row.overall_severity} /> : '—'}</td>
                          <td><Link className="link" to={`/analysis/${row.analysis_id}`}>View</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Upload queue — shared, Redux-backed widget (same data as Upload page) */}
            <UploadQueue />

            {/* Processing queue */}
            <div className="card">
              <div className="card-head">
                <h3>Processing queue</h3>
                <span className="sev" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                  <i style={{ background: 'var(--accent)' }}></i>{activeQueueCount} active
                </span>
              </div>
              <div className="py-3.5 px-[18px] flex flex-col gap-4">
                {(processing_queue || []).length === 0 ? (
                  <div className="text-[12.5px] text-muted py-4 text-center">Nothing processing right now.</div>
                ) : (
                  processing_queue.map((item) => {
                    const terminal = TERMINAL_STATUSES.has(item.status)
                    const waiting = item.status === 'queued' || item.status === 'pending'
                    return (
                      <Link
                        key={item.analysis_id}
                        to={`/analysis/${item.analysis_id}`}
                        className={`block no-underline text-inherit ${waiting || terminal ? 'opacity-55' : ''}`}
                      >
                        <div className="flex justify-between text-[13px]">
                          <b className="font-[550] truncate max-w-[160px]">{item.filename}</b>
                          {waiting ? (
                            <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>Queued</span>
                          ) : (
                            <span className="mono text-accent font-semibold text-[12px]">{item.progress ?? 0}%</span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden">
                          <i className="block h-full rounded-[99px] bg-[#e5e5e5]" style={{ width: `${item.progress ?? 0}%` }}></i>
                        </div>
                        <div className="text-[11.5px] text-muted">{item.stage || (waiting ? 'Waiting for worker' : item.status)}</div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
