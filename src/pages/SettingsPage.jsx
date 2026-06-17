export default function SettingsPage() {
  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h1
          style={{
            fontSize: '21px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '4px' }}>
          Configure your workspace and system preferences.
        </p>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
        Full screen coming in a later sprint.
      </p>
    </div>
  )
}
