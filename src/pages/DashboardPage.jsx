import { useSelector } from 'react-redux'
import '../styles/dashboard.css'

export default function DashboardPage() {
  const user = useSelector((s) => s.auth.user)
  const firstName = user?.name?.split(' ')[0] || 'Memoon'

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1>Good afternoon, {firstName}</h1>
          <p>Here is what AutoSmokeGuard detected across your cameras today.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}></div>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="kpis">

        {/* Total analyses */}
        <div className="card kpi">
          <div className="kpi-top">
            <span>Total analyses</span>
            <span className="delta up">▲ 12%</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-val mono">248</div>
            <svg width="92" height="30" viewBox="0 0 92 30" fill="none">
              <polyline points="2,24 14,20 26,22 38,15 50,17 62,10 74,12 86,5" stroke="#fafafa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* High severity */}
        <div className="card kpi">
          <div className="kpi-top">
            <span>High severity</span>
            <span className="delta down">▼ 8%</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-val mono">32</div>
            <svg width="92" height="30" viewBox="0 0 92 30" fill="none">
              <polyline points="2,10 14,14 26,9 38,16 50,12 62,18 74,15 86,21" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Reports issued */}
        <div className="card kpi">
          <div className="kpi-top">
            <span>Reports issued</span>
            <span className="delta up">▲ 9%</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-val mono">196</div>
            <svg width="92" height="30" viewBox="0 0 92 30" fill="none">
              <polyline points="2,22 14,18 26,20 38,14 50,16 62,11 74,13 86,6" stroke="#fafafa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Avg. confidence */}
        <div className="card kpi">
          <div className="kpi-top">
            <span>Avg. confidence</span>
            <span className="delta up">▲ 2.4%</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-val mono">0.91</div>
            <svg width="92" height="30" viewBox="0 0 92 30" fill="none">
              <polyline points="2,18 14,16 26,17 38,13 50,14 62,10 74,11 86,8" stroke="#a3a3a3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

      </div>

      {/* ── Row 2: line chart + donut chart ── */}
      <div className="grid-2">

        {/* Detections over time */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Detections over time</h3>
              <div className="sub">Vehicles flagged per day — last 30 days</div>
            </div>
            <div className="seg">
              <span className="on">30d</span>
              <span>90d</span>
              <span>1y</span>
            </div>
          </div>
          <svg className="chart" viewBox="0 0 760 230" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fafafa" stopOpacity=".25" />
                <stop offset="1" stopColor="#fafafa" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2="760" y1="46"  y2="46"  stroke="rgba(148,163,184,.08)" />
            <line x1="0" x2="760" y1="86"  y2="86"  stroke="rgba(148,163,184,.08)" />
            <line x1="0" x2="760" y1="126" y2="126" stroke="rgba(148,163,184,.08)" />
            <line x1="0" x2="760" y1="166" y2="166" stroke="rgba(148,163,184,.08)" />
            <line x1="0" x2="760" y1="206" y2="206" stroke="rgba(148,163,184,.08)" />
            <path
              d="M0,170 C40,160 60,135 100,140 C140,145 160,120 200,118 C240,116 260,135 300,128 C340,121 360,90 400,95 C440,100 460,80 500,74 C540,68 560,90 600,82 C640,74 660,55 700,50 C730,46 745,42 760,40 L760,230 L0,230 Z"
              fill="rgba(250,250,250,.07)"
            />
            <path
              d="M0,170 C40,160 60,135 100,140 C140,145 160,120 200,118 C240,116 260,135 300,128 C340,121 360,90 400,95 C440,100 460,80 500,74 C540,68 560,90 600,82 C640,74 660,55 700,50 C730,46 745,42 760,40"
              fill="none"
              stroke="#fafafa"
              strokeWidth="2.2"
            />
            <path
              d="M0,205 C50,202 80,195 130,196 C180,197 220,188 270,190 C320,192 360,180 410,182 C460,184 510,172 560,174 C610,176 660,162 710,164 C735,165 750,160 760,158"
              fill="none"
              stroke="#f87171"
              strokeWidth="1.8"
              strokeDasharray="1 0"
              opacity=".85"
            />
            <circle cx="500" cy="74" r="4" fill="#1f1f1f" stroke="#fafafa" strokeWidth="2.2" />
            <g transform="translate(430,18)">
              <rect width="148" height="40" rx="9" fill="#1f1f1f" stroke="rgba(148,163,184,.2)" />
              <text x="12" y="17" fill="#a3a3a3" fontSize="10" fontFamily="Plus Jakarta Sans">May 28</text>
              <text x="12" y="31" fill="#ededed" fontSize="11.5" fontWeight="600" fontFamily="Plus Jakarta Sans">14 detections · 3 high</text>
            </g>
          </svg>
          <div className="legend">
            <span><i style={{ background: '#fafafa' }}></i>All detections</span>
            <span><i style={{ background: '#f87171' }}></i>High severity</span>
          </div>
        </div>

        {/* Severity distribution donut */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Severity distribution</h3>
              <div className="sub">All-time breakdown</div>
            </div>
          </div>
          <div className="donut-wrap">
            <svg width="172" height="172" viewBox="0 0 172 172">
              <circle cx="86" cy="86" r="68" fill="none" stroke="rgba(148,163,184,.09)" strokeWidth="17" />
              <circle cx="86" cy="86" r="68" fill="none" stroke="#4ade80" strokeWidth="17" strokeDasharray="256 427" strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 86 86)" />
              <circle cx="86" cy="86" r="68" fill="none" stroke="#f59e0b" strokeWidth="17" strokeDasharray="112 427" strokeDashoffset="-264" strokeLinecap="round" transform="rotate(-90 86 86)" />
              <circle cx="86" cy="86" r="68" fill="none" stroke="#f87171" strokeWidth="17" strokeDasharray="47 427" strokeDashoffset="-384" strokeLinecap="round" transform="rotate(-90 86 86)" />
              <text x="86" y="82" textAnchor="middle" fill="#ededed" fontSize="27" fontWeight="650" fontFamily="Plus Jakarta Sans">248</text>
              <text x="86" y="101" textAnchor="middle" fill="#a3a3a3" fontSize="11" fontFamily="Plus Jakarta Sans">analyses</text>
            </svg>
            <div className="donut-legend">
              <div>
                <span className="sev sev-low"><i></i>Low</span>
                <b className="mono">149</b>
                <em>60%</em>
              </div>
              <div>
                <span className="sev sev-mod"><i></i>Moderate</span>
                <b className="mono">67</b>
                <em>27%</em>
              </div>
              <div>
                <span className="sev sev-high"><i></i>High</span>
                <b className="mono">32</b>
                <em>13%</em>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 3: recent analyses table + processing queue ── */}
      <div className="grid-3">

        {/* Recent analyses */}
        <div className="card">
          <div className="card-head">
            <h3>Recent analyses</h3>
            <a className="link" href="#">View all →</a>
          </div>
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
                  <div className="td-sub">traffic_cam_03.mp4</div>
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
                  <div className="td-sub">junction_n4_dusk.mp4</div>
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
                  <div className="td-sub">highway_e2_0609.mp4</div>
                </td>
                <td>Bus</td>
                <td className="mono">0.85</td>
                <td><span className="sev sev-mod"><i></i>Moderate</span></td>
                <td><a className="link" href="#">View</a></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Processing queue */}
        <div className="card">
          <div className="card-head">
            <h3>Processing queue</h3>
            <span className="sev" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              <i style={{ background: 'var(--accent)' }}></i>2 active
            </span>
          </div>
          <div className="queue">
            <div className="q-item">
              <div className="q-row">
                <b>traffic_cam_07.mp4</b>
                <span className="mono">62%</span>
              </div>
              <div className="bar"><i style={{ width: '62%' }}></i></div>
              <div className="q-sub">Smoke segmentation · ~40s remaining</div>
            </div>
            <div className="q-item">
              <div className="q-row">
                <b>ring_road_s1.mp4</b>
                <span className="mono">18%</span>
              </div>
              <div className="bar"><i style={{ width: '18%' }}></i></div>
              <div className="q-sub">Vehicle detection · ~2m remaining</div>
            </div>
            <div className="q-item dim">
              <div className="q-row">
                <b>depot_exit_cam.avi</b>
                <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>Queued</span>
              </div>
              <div className="bar"><i style={{ width: '0' }}></i></div>
              <div className="q-sub">Waiting for worker</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
