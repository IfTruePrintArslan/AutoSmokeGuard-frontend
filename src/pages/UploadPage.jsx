import { useState, useRef, useEffect, useCallback } from 'react'

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
  const isErr = entry.status === 'err'
  // visual icon-state: err rows render as the "q" (paused) icon box
  const iconState = isErr ? 'q' : entry.status

  return (
    <div className={`flex gap-3.5 items-start${entry.dim ? ' opacity-55' : ''}`}>
      {/* icon */}
      <div
        className={
          'w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center mt-0.5 relative' +
          (iconState === 'ok' ? ' bg-low-bg text-low' : '') +
          (iconState === 'run' ? ' bg-accent-glow' : '') +
          (iconState === 'q' ? ' bg-[rgba(148,163,184,0.1)]' : '')
        }
      >
        {iconState === 'ok' && <IconCheck />}
        {iconState === 'run' && (
          <span className="block w-[14px] h-[14px] rounded-[99px] border-[2.5px] border-white/25 border-t-accent animate-spin [animation-duration:0.7s]" />
        )}
        {iconState === 'q' && <span className="text-muted text-[12px]">⏸</span>}
      </div>

      {/* info */}
      <div className="flex-1">
        <div className="flex justify-between text-[13px]">
          <b className={`font-[550]${isErr ? ' text-high' : ''}`}>{entry.name}</b>
          <span className="mono text-muted text-[12px]">{entry.sizeLabel}</span>
        </div>

        {isErr ? (
          <div className="text-[11.5px] text-high mt-1">{entry.errMsg}</div>
        ) : (
          <>
            <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden">
              <i className="block h-full rounded-[99px] transition-[width] duration-[120ms] ease-linear" style={{ width: `${entry.progress}%`, background: entry.barColor }} />
            </div>
            <div className="text-[11.5px] text-muted">{entry.sub}</div>
          </>
        )}
      </div>

      {/* remove — only on real (non-seed) rows */}
      {!entry.seed && (
        <button
          className="bg-transparent border-none text-muted cursor-pointer text-[14px] leading-none py-1 px-1.5 rounded-[6px] flex-shrink-0 mt-0.5 transition-colors font-sans hover:text-high hover:bg-high-bg"
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
      className={
        'w-[36px] h-[21px] rounded-[99px] relative flex-shrink-0 cursor-pointer border-none p-0 ' +
        (on ? 'bg-[#fafafa]' : 'bg-[rgba(148,163,184,0.25)]')
      }
      onClick={onToggle}
      aria-pressed={on}
    >
      <i
        className={
          'absolute top-[2.5px] w-[16px] h-[16px] rounded-[99px] block transition-[left,background] duration-[150ms] ease-in-out ' +
          (on ? 'left-[17px] bg-[#0a0a0a]' : 'left-[3px] bg-[#cbd5e1]')
        }
      />
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

      <div className="grid grid-cols-[1fr_372px] gap-4">
        {/* ── LEFT column ── */}
        <div>
          {/* Dropzone */}
          <div
            className="card p-2.5 cursor-pointer"
            onClick={openPicker}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
          >
            <div
              className={
                'border-[1.5px] border-dashed rounded-[11px] flex flex-col items-center justify-center h-[300px] text-center transition-[border-color,background] duration-150 ease-out ' +
                (dragOver ? 'border-accent bg-[rgba(250,250,250,0.04)]' : 'border-white/40')
              }
            >
              <div className="w-[58px] h-[58px] rounded-[16px] bg-accent-glow text-accent flex items-center justify-center mb-[18px] shadow-[0_0_0_8px_rgba(255,255,255,0.05)]">
                <IconUpload />
              </div>
              <h3 className="text-[16.5px] font-[620]">Drag &amp; drop traffic footage</h3>
              <p className="text-[13px] text-text-2 mt-[7px]">
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
              <div className="flex items-center gap-2 mt-5">
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">MP4</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">AVI</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">MOV</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">JPEG</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">PNG</span>
                <em className="not-italic text-[11.5px] text-muted ml-1">· up to 2 GB</em>
              </div>
            </div>
          </div>

          {/* Upload queue */}
          <div className="card mt-4">
            <div className="card-head">
              <h3>Upload queue</h3>
              <span className="text-[12px] text-text-2">
                {fileCount} file{fileCount !== 1 ? 's' : ''} · {totalLabel} total
              </span>
            </div>
            <div className="pt-2 pb-4 px-[18px] flex flex-col gap-4">
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
        <div className="card">
          <div className="card-head">
            <h3>Analysis settings</h3>
          </div>
          <div className="pt-1.5 pb-[18px] px-[18px]">
            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Detection model</label>
            <div className="h-10 border border-line-2 rounded-[9px] bg-bg-2 flex items-center px-[13px] text-[13px] text-text">
              YOLOv8-seg · v2.3 <i className="ml-auto not-italic text-muted text-[11px]">▾</i>
            </div>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Smoke sensitivity</label>
            <div className="pt-1.5 px-0.5">
              <div className="h-[5px] rounded-[99px] bg-[rgba(148,163,184,0.15)] relative">
                <i className="absolute left-0 top-0 h-full rounded-[99px] bg-[#e5e5e5] block" style={{ width: '68%' }} />
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-[99px] bg-[#fafafa] shadow-[0_0_0_4px_rgba(255,255,255,0.25)]" style={{ left: '68%' }} />
              </div>
              <div className="flex justify-between text-[10.5px] text-muted mt-[9px]">
                <span>Low</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
            </div>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Frame sampling</label>
            <div className="h-10 border border-line-2 rounded-[9px] bg-bg-2 flex items-center px-[13px] text-[13px] text-text">
              Every 5th frame <i className="ml-auto not-italic text-muted text-[11px]">▾</i>
            </div>

            <div className="mt-[22px] flex flex-col gap-[15px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">Auto-generate PDF report</b>
                  <span className="text-[11px] text-muted">Create report when analysis completes</span>
                </div>
                <Switch on={pdfReport} onToggle={() => setPdfReport((v) => !v)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">License plate redaction</b>
                  <span className="text-[11px] text-muted">Blur plates in exported frames</span>
                </div>
                <Switch on={plateRedact} onToggle={() => setPlateRedact((v) => !v)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">Night-mode enhancement</b>
                  <span className="text-[11px] text-muted">Boost contrast for low-light footage</span>
                </div>
                <Switch on={nightMode} onToggle={() => setNightMode((v) => !v)} />
              </div>
            </div>

            <button
              className="btn btn-pri w-full h-[42px] justify-center mt-[22px]"
              type="button"
            >
              Start analysis
            </button>

            <p className="text-[11.5px] text-muted text-center mt-3">
              Estimated processing time:{' '}
              <b className="text-text-2">~{readyCount < 3 ? '2 min' : `${Math.ceil(readyCount * 0.8)} min`}</b>{' '}
              for {readyCount} ready file{readyCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
