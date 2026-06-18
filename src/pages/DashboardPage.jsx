import { useSelector } from 'react-redux'
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

/* ── Dummy data ── */

const detectionData = [
  { day: 'May 1',  detections: 6,  high: 1 },
  { day: 'May 2',  detections: 7,  high: 1 },
  { day: 'May 3',  detections: 8,  high: 2 },
  { day: 'May 4',  detections: 7,  high: 1 },
  { day: 'May 5',  detections: 9,  high: 2 },
  { day: 'May 6',  detections: 10, high: 2 },
  { day: 'May 7',  detections: 9,  high: 2 },
  { day: 'May 8',  detections: 11, high: 2 },
  { day: 'May 9',  detections: 10, high: 2 },
  { day: 'May 10', detections: 12, high: 2 },
  { day: 'May 11', detections: 11, high: 3 },
  { day: 'May 12', detections: 13, high: 2 },
  { day: 'May 13', detections: 12, high: 3 },
  { day: 'May 14', detections: 14, high: 3 },
  { day: 'May 15', detections: 13, high: 3 },
  { day: 'May 16', detections: 15, high: 3 },
  { day: 'May 17', detections: 14, high: 3 },
  { day: 'May 18', detections: 16, high: 4 },
  { day: 'May 19', detections: 15, high: 3 },
  { day: 'May 20', detections: 17, high: 4 },
  { day: 'May 21', detections: 16, high: 4 },
  { day: 'May 22', detections: 18, high: 4 },
  { day: 'May 23', detections: 17, high: 4 },
  { day: 'May 24', detections: 19, high: 5 },
  { day: 'May 25', detections: 18, high: 4 },
  { day: 'May 26', detections: 20, high: 5 },
  { day: 'May 27', detections: 19, high: 5 },
  { day: 'May 28', detections: 14, high: 3 },
  { day: 'May 29', detections: 21, high: 5 },
  { day: 'May 30', detections: 22, high: 6 },
]

const sparkTotal    = [6,7,8,7,9,10,11,13,14,16,17,19,21,22].map((v) => ({ v }))
const sparkHigh     = [4,5,4,5,3,4,4,3,3,2,2,2,1,2].map((v) => ({ v }))
const sparkReports  = [3,4,4,5,6,6,7,8,9,10,11,12,14,15].map((v) => ({ v }))
const sparkConf     = [82,83,83,84,85,85,86,87,87,88,89,90,90,91].map((v) => ({ v }))

/* ── Custom tooltips ── */

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const det = payload.find((p) => p.dataKey === 'detections')
  const hi  = payload.find((p) => p.dataKey === 'high')
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

export default function DashboardPage() {
  const user = useSelector((s) => s.auth.user)
  const firstName = user?.name?.split(' ')[0] || 'Memoon'

  return (
    <div className="flex flex-col">
      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1>Good afternoon, {firstName}</h1>
          <p>Here is what AutoSmokeGuard detected across your cameras today.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}></div>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

        {/* Total analyses */}
        <div className="card py-4 px-[18px]">
          <div className="flex justify-between text-[12.5px] text-text-2">
            <span>Total analyses</span>
            <span className="text-[11px] font-semibold py-0.5 px-[7px] rounded-[99px] text-low bg-low-bg">▲ 12%</span>
          </div>
          <div className="flex items-end justify-between mt-2.5">
            <div className="mono text-[27px] font-[650] tracking-[-0.03em]">248</div>
            <ResponsiveContainer width={92} height={34}>
              <LineChart data={sparkTotal}>
                <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke="#fafafa" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High severity */}
        <div className="card py-4 px-[18px]">
          <div className="flex justify-between text-[12.5px] text-text-2">
            <span>High severity</span>
            <span className="text-[11px] font-semibold py-0.5 px-[7px] rounded-[99px] text-high bg-high-bg">▼ 8%</span>
          </div>
          <div className="flex items-end justify-between mt-2.5">
            <div className="mono text-[27px] font-[650] tracking-[-0.03em]">32</div>
            <ResponsiveContainer width={92} height={34}>
              <LineChart data={sparkHigh}>
                <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke="#f87171" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reports issued */}
        <div className="card py-4 px-[18px]">
          <div className="flex justify-between text-[12.5px] text-text-2">
            <span>Reports issued</span>
            <span className="text-[11px] font-semibold py-0.5 px-[7px] rounded-[99px] text-low bg-low-bg">▲ 9%</span>
          </div>
          <div className="flex items-end justify-between mt-2.5">
            <div className="mono text-[27px] font-[650] tracking-[-0.03em]">196</div>
            <ResponsiveContainer width={92} height={34}>
              <LineChart data={sparkReports}>
                <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke="#fafafa" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg. confidence */}
        <div className="card py-4 px-[18px]">
          <div className="flex justify-between text-[12.5px] text-text-2">
            <span>Avg. confidence</span>
            <span className="text-[11px] font-semibold py-0.5 px-[7px] rounded-[99px] text-low bg-low-bg">▲ 2.4%</span>
          </div>
          <div className="flex items-end justify-between mt-2.5">
            <div className="mono text-[27px] font-[650] tracking-[-0.03em]">0.91</div>
            <ResponsiveContainer width={92} height={34}>
              <LineChart data={sparkConf}>
                <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke="#a3a3a3" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── Row 2: line chart + donut chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-4 items-stretch">

        {/* Detections over time */}
        <div className="card flex flex-col">
          <div className="card-head">
            <div>
              <h3>Detections over time</h3>
              <div className="sub">Vehicles flagged per day — last 30 days</div>
            </div>
            <div className="flex border border-line-2 rounded-lg overflow-hidden">
              <span className="text-[11.5px] py-[5px] px-[11px] bg-white/[0.13] text-accent font-semibold">30d</span>
              <span className="text-[11.5px] py-[5px] px-[11px] text-text-2">90d</span>
              <span className="text-[11.5px] py-[5px] px-[11px] text-text-2">1y</span>
            </div>
          </div>
          <div className="w-[calc(100%-36px)] h-[300px] mt-3.5 mx-[18px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={detectionData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="detGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fafafa" stopOpacity={0.10} />
                    <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#232323" />
                <XAxis dataKey="day" hide />
                <YAxis hide />
                <Tooltip
                  content={<CustomLineTooltip />}
                  cursor={{ stroke: '#2e2e2e' }}
                />
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
          </div>
          <div className="flex gap-[18px] pt-2.5 pb-3.5 px-[18px] text-[12px] text-text-2">
            <span><i className="inline-block w-2 h-2 rounded-[2px] mr-[7px]" style={{ background: '#fafafa' }}></i>All detections</span>
            <span><i className="inline-block w-2 h-2 rounded-[2px] mr-[7px]" style={{ background: '#f87171' }}></i>High severity</span>
          </div>
        </div>

        {/* Severity distribution donut */}
        <div className="h-[320px] lg:h-full">
          <SeverityDistribution className="h-full" />
        </div>

      </div>

      {/* ── Row 3: recent analyses table + upload queue + processing queue ──
          lg+ : three columns that fit within the content width (minmax(0,…)
          lets every column shrink, so the row never overflows past the right
          edge). <lg : Recent analyses spans full width, the two queue cards
          drop below it (2-col at md, 1-col on mobile). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)_minmax(0,300px)] gap-4 items-stretch">

        {/* Recent analyses */}
        <div className="card md:col-span-2 lg:col-span-1 overflow-hidden">
          <div className="card-head">
            <h3>Recent analyses</h3>
            <a className="link" href="#">View all →</a>
          </div>
          {/* horizontal-scroll wrapper so columns don't crush on mobile */}
          <div className="overflow-x-auto">
          <table style={{ marginTop: '8px' }}>
            <tbody>
              <tr>
                <th>Source</th>
                <th>Report</th>
                <th>Vehicle</th>
                <th>Confidence</th>
                <th>Severity</th>
                <th></th>
              </tr>
              <tr>
                <td><div className="thumb"></div></td>
                <td>
                  <b style={{ fontWeight: 560 }}>#1042</b>
                  <div className="text-[11.5px] text-muted mt-0.5">traffic_cam_03.mp4</div>
                </td>
                <td>Truck</td>
                <td className="mono">0.92</td>
                <td><span className="sev sev-high"><i></i>High</span></td>
                <td><a className="link" href="#">View</a></td>
              </tr>
              <tr>
                <td><div className="thumb"></div></td>
                <td>
                  <b style={{ fontWeight: 560 }}>#1041</b>
                  <div className="text-[11.5px] text-muted mt-0.5">junction_n4_dusk.mp4</div>
                </td>
                <td>Sedan</td>
                <td className="mono">0.88</td>
                <td><span className="sev sev-low"><i></i>Low</span></td>
                <td><a className="link" href="#">View</a></td>
              </tr>
              <tr>
                <td><div className="thumb"></div></td>
                <td>
                  <b style={{ fontWeight: 560 }}>#1040</b>
                  <div className="text-[11.5px] text-muted mt-0.5">highway_e2_0609.mp4</div>
                </td>
                <td>Bus</td>
                <td className="mono">0.85</td>
                <td><span className="sev sev-mod"><i></i>Moderate</span></td>
                <td><a className="link" href="#">View</a></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        {/* Upload queue — shared, Redux-backed widget (same data as Upload page) */}
        <UploadQueue />

        {/* Processing queue */}
        <div className="card">
          <div className="card-head">
            <h3>Processing queue</h3>
            <span className="sev" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              <i style={{ background: 'var(--accent)' }}></i>2 active
            </span>
          </div>
          <div className="py-3.5 px-[18px] flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-[13px]">
                <b className="font-[550]">traffic_cam_07.mp4</b>
                <span className="mono text-accent font-semibold text-[12px]">62%</span>
              </div>
              <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden"><i className="block h-full rounded-[99px] bg-[#e5e5e5]" style={{ width: '62%' }}></i></div>
              <div className="text-[11.5px] text-muted">Smoke segmentation · ~40s remaining</div>
            </div>
            <div>
              <div className="flex justify-between text-[13px]">
                <b className="font-[550]">ring_road_s1.mp4</b>
                <span className="mono text-accent font-semibold text-[12px]">18%</span>
              </div>
              <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden"><i className="block h-full rounded-[99px] bg-[#e5e5e5]" style={{ width: '18%' }}></i></div>
              <div className="text-[11.5px] text-muted">Vehicle detection · ~2m remaining</div>
            </div>
            <div className="opacity-55">
              <div className="flex justify-between text-[13px]">
                <b className="font-[550]">depot_exit_cam.avi</b>
                <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>Queued</span>
              </div>
              <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden"><i className="block h-full rounded-[99px] bg-[#e5e5e5]" style={{ width: '0' }}></i></div>
              <div className="text-[11.5px] text-muted">Waiting for worker</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
