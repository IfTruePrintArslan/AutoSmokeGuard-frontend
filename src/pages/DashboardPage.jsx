export default function DashboardPage() {
  return (
    <div>
      <div
        className="flex items-end justify-between"
        style={{ marginBottom: '22px' }}
      >
        <div>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Good afternoon, Memoon
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '4px' }}>
            Here is what AutoSmokeGuard detected across your cameras today.
          </p>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
        Full screen coming in a later sprint.
      </p>
    </div>
  )
}
