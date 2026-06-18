import { useState, useRef, useEffect, useCallback } from 'react'
import '../styles/upload.css'

/* ─────────────────────────────────────────────
   Constants & validation
───────────────────────────────────────────── */

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/x-msvideo',
  'video/avi',
  'video/quicktime',  // MOV
  'image/jpeg',
  'image/png',
])

const ALLOWED_EXT = new Set(['.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png'])

const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

const TICK_MS = 80
const UPLOAD_DURATION_MS = 3000 // ~3 s simulated upload

function fileExt(name) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function validateFile(file) {
  const ext = fileExt(file.name)
  const mimeOk = ALLOWED_MIME.has(file.type)
  const extOk  = ALLOWED_EXT.has(ext)
  if (!mimeOk && !extOk) return 'Unsupported file type'
  if (file.size > MAX_BYTES) return `Exceeds 2 GB (${(file.size / 1e9).toFixed(1)} GB)`
  return null
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/* ─────────────────────────────────────────────
   Demo / seed rows shown on initial render
   (status is a string — 'ok' | 'run' | 'q' | 'err')
───────────────────────────────────────────── */

const SEED_FILES = [
  {
    id: '__seed_1',
    name: 'traffic_cam_03.mp4',
    sizeLabel: '128 MB',
    sizeMB: 128,
    status: 'ok',
    progress: 100,
    sub: 'Uploaded · ready for analysis',
    barColor: 'var(--low)',
    seed: true,
  },
  {
    id: '__seed_2',
    name: 'junction_n4_dusk.mp4',
    sizeLabel: '96 MB',
    sizeMB: 96,
    status: 'run',
    progress: 64,
    sub: 'Uploading… 64% · 1.2 MB/s',
    barColor: '#e5e5e5',
    seed: true,
  },
  {
    id: '__seed_3',
    name: 'highway_e2_0610.avi',
    sizeLabel: '88 MB',
    sizeMB: 88,
    status: 'q',
    progress: 0,
    sub: 'Queued',
    barColor: '#e5e5e5',
    dim: true,
    seed: true,
  },
]

/* ─────────────────────────────────────────────
   Inline SVG icons — verbatim from mockup
───────────────────────────────────────────── */

function IconUpload() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3"/>
      <path d="M12 3v12"/>
      <path d="m7 8 5-5 5 5"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   FileRow — renders one .f-row
   Handles both seed rows and real rows
───────────────────────────────────────────── */

function FileRow({ entry, onRemove }) {
  const dimClass  = entry.dim ? ' dim' : ''
  const errClass  = entry.status === 'err' ? ' err' : ''

  return (
    <div className={`f-row${dimClass}${errClass}`}>
      {/* icon */}
      <div className={`f-ic ${entry.status === 'err' ? 'q' : entry.status}`}>
        {entry.status === 'ok' && <IconCheck />}
      </div>

      {/* info */}
      <div className="f-info">
        <div className="f-name">
          <b>{entry.name}</b>
          <span className="mono">{entry.sizeLabel}</span>
        </div>

        {entry.status === 'err' ? (
          <div className="f-err">{entry.errMsg}</div>
        ) : (
          <>
            <div className="bar">
              <i style={{ width: `${entry.progress}%`, background: entry.barColor }} />
            </div>
            <div className="f-sub">{entry.sub}</div>
          </>
        )}
      </div>

      {/* remove — only on real (non-seed) rows */}
      {!entry.seed && (
        <button
          className="f-remove"
          type="button"
          title="Remove"
          onClick={() => onRemove(entry.id)}
        >
          ×
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Switch toggle
───────────────────────────────────────────── */

function Switch({ on, onToggle }) {
  return (
    <button
      type="button"
      className={`switch${on ? ' on' : ''}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <i />
    </button>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */

export default function UploadPage() {
  // real user-added files (seed rows are separate + static display)
  const [userFiles, setUserFiles] = useState([])
  const [dragOver, setDragOver]   = useState(false)

  // settings toggles
  const [pdfReport,   setPdfReport]   = useState(true)
  const [plateRedact, setPlateRedact] = useState(true)
  const [nightMode,   setNightMode]   = useState(false)

  const inputRef  = useRef(null)
  const timersRef = useRef({})

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval)
    }
  }, [])

  /* ── Simulated upload progress ── */
  const startUpload = useCallback((id) => {
    const totalTicks = Math.ceil(UPLOAD_DURATION_MS / TICK_MS)
    let tick = 0

    const iid = setInterval(() => {
      tick++
      const raw = tick / totalTicks
      const pct = Math.min(Math.round(100 * (1 - Math.pow(1 - raw, 2))), 100)

      setUserFiles((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e
          if (pct >= 100) {
            return { ...e, progress: 100, status: 'ok', barColor: 'var(--low)', sub: 'Uploaded · ready for analysis' }
          }
          return {
            ...e,
            progress: pct,
            sub: `Uploading… ${pct}%`,
          }
        })
      )

      if (tick >= totalTicks) {
        clearInterval(iid)
        delete timersRef.current[id]
      }
    }, TICK_MS)

    timersRef.current[id] = iid
  }, [])

  /* ── Add files ── */
  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList)
      setUserFiles((prev) => {
        const existingKeys = new Set(prev.map((e) => `${e.name}|${e.rawSize}`))
        const newEntries = incoming
          .filter((f) => !existingKeys.has(`${f.name}|${f.size}`))
          .map((f) => {
            const errMsg = validateFile(f)
            const base = {
              id: crypto.randomUUID(),
              name: f.name,
              sizeLabel: fmtSize(f.size),
              rawSize: f.size,
              seed: false,
            }
            if (errMsg) {
              return { ...base, status: 'err', errMsg, progress: 0, barColor: '#e5e5e5', sub: '' }
            }
            return {
              ...base,
              status: 'run',
              errMsg: null,
              progress: 0,
              barColor: '#e5e5e5',
              sub: 'Uploading… 0%',
            }
          })

        newEntries.forEach((e) => {
          if (e.status === 'run') startUpload(e.id)
        })

        return [...prev, ...newEntries]
      })
    },
    [startUpload]
  )

  /* ── Remove ── */
  const removeFile = useCallback((id) => {
    if (timersRef.current[id]) {
      clearInterval(timersRef.current[id])
      delete timersRef.current[id]
    }
    setUserFiles((prev) => prev.filter((e) => e.id !== id))
  }, [])

  /* ── Drag handlers ── */
  const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  const onDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  const onDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
  }
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const openPicker = () => inputRef.current?.click()

  /* ── Queue stats ── */
  const allRows   = [...SEED_FILES, ...userFiles]
  // count: seed 3 + user non-error rows
  const fileCount = 3 + userFiles.filter((e) => e.status !== 'err').length
  // total MB: seed fixed + real sizes
  const totalMB   = 312 + userFiles
    .filter((e) => e.status !== 'err')
    .reduce((acc, e) => acc + (e.rawSize || 0) / (1024 * 1024), 0)
  const totalLabel =
    totalMB < 1024 ? `${Math.round(totalMB)} MB` : `${(totalMB / 1024).toFixed(1)} GB`

  // ready files (seed 1 is "ok", user 'ok' rows)
  const readyCount = 1 + userFiles.filter((e) => e.status === 'ok').length

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1>Upload media</h1>
          <p>Add traffic footage or stills for emission analysis.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }} />
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/mp4,video/x-msvideo,video/avi,video/quicktime,image/jpeg,image/png,.mp4,.avi,.mov,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="up-grid">
        {/* ── LEFT column ── */}
        <div>
          {/* Dropzone */}
          <div
            className="card drop"
            onClick={openPicker}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
          >
            <div className={`drop-inner${dragOver ? ' drag-over' : ''}`}>
              <div className="drop-ic">
                <IconUpload />
              </div>
              <h3>Drag &amp; drop traffic footage</h3>
              <p>
                or{' '}
                <a
                  className="link"
                  href="#"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPicker() }}
                >
                  browse files
                </a>{' '}
                from your computer
              </p>
              <div className="chips">
                <span>MP4</span>
                <span>AVI</span>
                <span>MOV</span>
                <span>JPEG</span>
                <span>PNG</span>
                <em>· up to 2 GB</em>
              </div>
            </div>
          </div>

          {/* Upload queue */}
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-head">
              <h3>Upload queue</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                {fileCount} file{fileCount !== 1 ? 's' : ''} · {totalLabel} total
              </span>
            </div>
            <div className="files">
              {/* Seed rows — always rendered first */}
              {SEED_FILES.map((entry) => (
                <FileRow key={entry.id} entry={entry} onRemove={removeFile} />
              ))}
              {/* Real user-added rows */}
              {userFiles.map((entry) => (
                <FileRow key={entry.id} entry={entry} onRemove={removeFile} />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT column — Analysis settings ── */}
        <div className="card settings">
          <div className="card-head">
            <h3>Analysis settings</h3>
          </div>
          <div className="set-body">
            <label>Detection model</label>
            <div className="input sel">
              YOLOv8-seg · v2.3 <i>▾</i>
            </div>

            <label>Smoke sensitivity</label>
            <div className="slider">
              <div className="sl-track">
                <i style={{ width: '68%' }} />
                <span className="sl-knob" style={{ left: '68%' }} />
              </div>
              <div className="sl-marks">
                <span>Low</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
            </div>

            <label>Frame sampling</label>
            <div className="input sel">
              Every 5th frame <i>▾</i>
            </div>

            <div className="toggles">
              <div className="tg">
                <div>
                  <b>Auto-generate PDF report</b>
                  <span>Create report when analysis completes</span>
                </div>
                <Switch on={pdfReport} onToggle={() => setPdfReport((v) => !v)} />
              </div>
              <div className="tg">
                <div>
                  <b>License plate redaction</b>
                  <span>Blur plates in exported frames</span>
                </div>
                <Switch on={plateRedact} onToggle={() => setPlateRedact((v) => !v)} />
              </div>
              <div className="tg">
                <div>
                  <b>Night-mode enhancement</b>
                  <span>Boost contrast for low-light footage</span>
                </div>
                <Switch on={nightMode} onToggle={() => setNightMode((v) => !v)} />
              </div>
            </div>

            <button
              className="btn btn-pri"
              type="button"
              style={{ width: '100%', height: '42px', justifyContent: 'center', marginTop: '22px' }}
            >
              Start analysis
            </button>

            <p className="eta">
              Estimated processing time:{' '}
              <b>~{readyCount < 3 ? '2 min' : `${Math.ceil(readyCount * 0.8)} min`}</b>{' '}
              for {readyCount} ready file{readyCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
