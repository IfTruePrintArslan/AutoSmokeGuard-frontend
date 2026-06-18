import { useSelector } from 'react-redux'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

/* ── Custom dark tooltip ── */
function CustomDonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0]
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid #2e2e2e',
        borderRadius: '8px',
        padding: '8px 10px',
        fontFamily: 'var(--font)',
        fontSize: '12px',
        color: '#ededed',
      }}
    >
      <span style={{ color: item.payload.color, fontWeight: 600 }}>{item.payload.label}</span>
      {' · '}
      {item.value}
      {' · '}
      {item.payload.pct}%
    </div>
  )
}

const SEV_CLASS = {
  low: 'sev-low',
  mod: 'sev-mod',
  high: 'sev-high',
}

export default function SeverityDistribution({ className = '' }) {
  const severity = useSelector((s) => s.analysis.severity)
  const { total, items } = severity

  return (
    <div className={`card h-full flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* 1. Card header — never shrinks */}
      <div className="card-head shrink-0">
        <div>
          <h3>Severity distribution</h3>
          <div className="sub">All-time breakdown</div>
        </div>
      </div>

      {/* 2. Donut area — grows/shrinks to fill available space */}
      <div className="flex-1 min-h-[120px] relative px-[22px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              cx="50%"
              cy="50%"
              innerRadius="38%"
              outerRadius="52%"
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {items.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomDonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label — absolutely centered over the donut */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            lineHeight: 1.2,
          }}
        >
          <div style={{ fontSize: '26px', fontWeight: 650, color: '#ededed', fontFamily: 'var(--font)', letterSpacing: '-.03em' }}>
            {total}
          </div>
          <div style={{ fontSize: '11px', color: '#6f6f6f', fontFamily: 'var(--font)' }}>analyses</div>
        </div>
      </div>

      {/* 3. Legend — single horizontal row, never shrinks */}
      <div className="shrink-0 w-full px-[22px] pb-4 pt-2 flex justify-between gap-2">
        {items.map((entry) => (
          <div key={entry.key} className="flex items-center gap-[5px] min-w-0">
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, color: '#9a9a9a', whiteSpace: 'nowrap' }}>{entry.label}</span>
            <b style={{ fontSize: 12, fontWeight: 600, color: '#ededed', whiteSpace: 'nowrap' }}>{entry.value}</b>
            <span style={{ fontSize: 11, color: '#6f6f6f', whiteSpace: 'nowrap' }}>· {entry.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
