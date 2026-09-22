import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Slider } from '../components/ui/slider'
import { Switch } from '../components/ui/switch'
import Spinner from '../components/ui/Spinner'
import Skeleton from '../components/ui/Skeleton'
import ErrorState from '../components/ui/ErrorState'
import { fetchSettings, saveSettings, clearFieldErrors } from '../features/settings/settingsSlice'
import { logout } from '../features/auth/authSlice'
import { pushToast } from '../features/ui/uiSlice'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })
  } catch {
    return iso
  }
}

function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/* ── Comma-chip editor for the two allowed-format lists ── */
function ChipEditor({ label, values, onChange, disabled, fieldError }) {
  const [input, setInput] = useState('')
  const id = `field-${slug(label)}`

  const addChip = () => {
    const v = input.trim().toLowerCase().replace(/^\.+/, '')
    if (!v) return
    if (!values.includes(v)) onChange([...values, v])
    setInput('')
  }
  const removeChip = (v) => onChange(values.filter((x) => x !== v))

  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-[560] text-[#d4d4d4] mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 text-[11px] font-semibold py-1 px-2 rounded-[6px] border border-line-2 text-text-2">
            {v.toUpperCase()}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${v}`}
                className="text-muted hover:text-high bg-transparent border-none cursor-pointer leading-none p-0"
                onClick={() => removeChip(v)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && <span className="text-[11.5px] text-muted">None</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            id={id}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addChip()
              }
            }}
            placeholder="Add format (e.g. webp)"
            className="h-9 flex-1 rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text outline-none focus-visible:border-text-3"
          />
          <button type="button" className="btn btn-ghost" onClick={addChip}>Add</button>
        </div>
      )}
      {fieldError && <p className="text-[11.5px] text-high mt-1.5">{fieldError}</p>}
    </div>
  )
}

function NumberField({ label, value, onChange, disabled, min, fieldError, suffix }) {
  const id = `field-${slug(label)}`
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-[560] text-[#d4d4d4] mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text outline-none focus-visible:border-text-3 disabled:opacity-50"
        />
        {suffix && <span className="text-[12px] text-muted shrink-0">{suffix}</span>}
      </div>
      {fieldError && <p className="text-[11.5px] text-high mt-1.5">{fieldError}</p>}
    </div>
  )
}

function SliderField({ label, value, onChange, disabled, min = 0, max = 1, step = 0.01, hint, fieldError }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-[12.5px] font-[560] text-[#d4d4d4]">{label}</label>
        <span className="mono text-[12px] text-text-2">{Number(value).toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
      />
      {hint && <p className="text-[11px] text-muted mt-1.5">{hint}</p>}
      {fieldError && <p className="text-[11.5px] text-high mt-1.5">{fieldError}</p>}
    </div>
  )
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-[9px] border border-line-2 bg-bg-2 px-3 py-2.5">
      <div className="text-[10.5px] text-muted uppercase tracking-[0.06em]">{label}</div>
      <div className="mono text-[14px] font-semibold mt-1">{value}</div>
    </div>
  )
}

const FIELDS = [
  'allowed_image_formats', 'allowed_video_formats', 'max_upload_mb',
  'confidence_threshold', 'smoke_mask_threshold', 'severity_low_max',
  'severity_moderate_max', 'frame_sample_rate', 'auto_generate_pdf', 'max_video_seconds',
]

export default function SettingsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)
  const isAdmin = user?.role === 'admin'
  const { data, status, error, fieldErrors, saveStatus } = useSelector((s) => s.settings)

  const [form, setForm] = useState(null)
  const [severityError, setSeverityError] = useState('')

  useEffect(() => {
    dispatch(fetchSettings())
  }, [dispatch])

  // Populate the editable form once the fetched SettingsObj arrives — this
  // adjusts state during render (React's documented pattern for syncing
  // local state from a prop/store value that just became available) rather
  // than in an effect.
  if (data && !form) {
    setForm(data)
  }

  useEffect(() => {
    if (saveStatus === 'fulfilled') {
      dispatch(pushToast({ message: 'Settings saved.', variant: 'success' }))
    }
  }, [saveStatus, dispatch])

  const dirty = useMemo(() => {
    if (!form || !data) return false
    return FIELDS.some((key) => JSON.stringify(form[key]) !== JSON.stringify(data[key]))
  }, [form, data])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (Object.keys(fieldErrors).length) dispatch(clearFieldErrors())
  }

  const handleReset = () => {
    setForm(data)
    setSeverityError('')
    dispatch(clearFieldErrors())
  }

  const handleSave = async () => {
    if (form.severity_low_max >= form.severity_moderate_max) {
      setSeverityError('Low threshold must be less than the moderate threshold.')
      return
    }
    setSeverityError('')
    const patch = {}
    FIELDS.forEach((key) => { patch[key] = form[key] })
    await dispatch(saveSettings(patch))
  }

  async function handleSignOut() {
    await dispatch(logout())
    navigate('/login')
  }

  if (status === 'pending' && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[220px]" />
        <Skeleton className="h-[420px]" />
      </div>
    )
  }

  if (status === 'rejected' && !data) {
    return <ErrorState message={error} onRetry={() => dispatch(fetchSettings())} />
  }

  if (!form) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Configure your workspace and system preferences.</p>
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <div className="card-head"><h3>Account</h3></div>
        <div className="p-[18px] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[14px] font-semibold">{user?.full_name}</div>
              <div className="text-[12.5px] text-text-2 mt-0.5">{user?.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="sev" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                <i style={{ background: 'var(--accent)' }} />
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
          <div className="text-[11.5px] text-muted">Member since {fmtDate(user?.created_at)}</div>
        </div>
      </div>

      {/* System configuration */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>System configuration</h3>
            <div className="sub">Applies to every new analysis unless overridden per-upload.</div>
          </div>
          {dirty && isAdmin && <span className="text-[11px] font-semibold text-mod">Unsaved changes</span>}
        </div>

        {!isAdmin && (
          <div className="mx-[18px] mt-4 rounded-[9px] border border-line-2 bg-bg-2 px-3 py-2.5 text-[12px] text-text-2">
            Administrator access required to change system configuration. Showing current values, read-only.
          </div>
        )}

        <div className="p-[18px] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <ChipEditor
            label="Allowed image formats"
            values={form.allowed_image_formats}
            onChange={(v) => setField('allowed_image_formats', v)}
            disabled={!isAdmin}
            fieldError={fieldErrors.allowed_image_formats}
          />
          <ChipEditor
            label="Allowed video formats"
            values={form.allowed_video_formats}
            onChange={(v) => setField('allowed_video_formats', v)}
            disabled={!isAdmin}
            fieldError={fieldErrors.allowed_video_formats}
          />
          <NumberField
            label="Max upload size"
            value={form.max_upload_mb}
            onChange={(v) => setField('max_upload_mb', v)}
            disabled={!isAdmin}
            min={1}
            suffix="MB"
            fieldError={fieldErrors.max_upload_mb}
          />
          <NumberField
            label="Max video duration"
            value={form.max_video_seconds}
            onChange={(v) => setField('max_video_seconds', v)}
            disabled={!isAdmin}
            min={1}
            suffix="sec"
            fieldError={fieldErrors.max_video_seconds}
          />
          <NumberField
            label="Frame sample rate"
            value={form.frame_sample_rate}
            onChange={(v) => setField('frame_sample_rate', v)}
            disabled={!isAdmin}
            min={1}
            suffix="frames"
            fieldError={fieldErrors.frame_sample_rate}
          />

          <div className="flex items-center justify-between gap-3 sm:col-span-1">
            <div>
              <b className="text-[12.5px] font-[550] block">Auto-generate PDF report</b>
              <span className="text-[11px] text-muted">Create a report automatically when an analysis completes</span>
            </div>
            <Switch
              checked={form.auto_generate_pdf}
              onCheckedChange={(v) => setField('auto_generate_pdf', v)}
              disabled={!isAdmin}
              aria-label="Auto-generate PDF report"
            />
          </div>

          <SliderField
            label="Confidence threshold"
            value={form.confidence_threshold}
            onChange={(v) => setField('confidence_threshold', v)}
            disabled={!isAdmin}
            fieldError={fieldErrors.confidence_threshold}
          />
          <SliderField
            label="Smoke mask threshold"
            value={form.smoke_mask_threshold}
            onChange={(v) => setField('smoke_mask_threshold', v)}
            disabled={!isAdmin}
            fieldError={fieldErrors.smoke_mask_threshold}
          />
          <SliderField
            label="Severity — low max"
            value={form.severity_low_max}
            onChange={(v) => setField('severity_low_max', v)}
            disabled={!isAdmin}
            hint="Below this, detections are classified 'low' severity."
            fieldError={fieldErrors.severity_low_max}
          />
          <SliderField
            label="Severity — moderate max"
            value={form.severity_moderate_max}
            onChange={(v) => setField('severity_moderate_max', v)}
            disabled={!isAdmin}
            hint="Below this, detections are classified 'moderate'; above is 'high'."
            fieldError={fieldErrors.severity_moderate_max}
          />
        </div>

        {severityError && (
          <p className="text-[12px] text-high px-[18px] pb-2">{severityError}</p>
        )}

        {isAdmin && (
          <div className="flex items-center justify-end gap-2 px-[18px] pb-[18px]">
            <button type="button" className="btn btn-ghost" onClick={handleReset} disabled={!dirty}>
              Reset
            </button>
            <button
              type="button"
              className="btn btn-pri disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={!dirty || saveStatus === 'pending'}
            >
              {saveStatus === 'pending' && <Spinner size={14} />}
              {saveStatus === 'pending' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* Runtime — read-only */}
      {data?.runtime && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Runtime</h3>
              <div className="sub">Read-only — reflects the currently loaded ML backend.</div>
            </div>
          </div>
          <div className="p-[18px] grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatChip label="Device" value={data.runtime.device} />
            <StatChip label="Segmenter" value={data.runtime.segmenter_mode} />
            <StatChip label="YOLO weights" value={data.runtime.yolo_weights_present ? 'Present' : 'Missing'} />
            <StatChip label="Segmenter weights" value={data.runtime.segmenter_weights_present ? 'Present' : 'Missing'} />
            <StatChip label="Worker threads" value={data.runtime.worker_threads} />
            {data.runtime.model_metrics ? (
              <>
                <StatChip label="Dice" value={data.runtime.model_metrics.dice?.toFixed(2)} />
                <StatChip label="IoU" value={data.runtime.model_metrics.iou?.toFixed(2)} />
                <StatChip label="Pixel accuracy" value={data.runtime.model_metrics.pixel_accuracy?.toFixed(2)} />
              </>
            ) : (
              <StatChip label="Model metrics" value="Unavailable" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
