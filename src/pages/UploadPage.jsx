import { useState, useRef, useEffect, useCallback } from 'react'
import '../styles/dashboard.css'
import '../styles/upload.css'

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/x-msvideo', // AVI
  'video/avi',       // some browsers report this variant
])

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.mp4', '.avi'])

const IMAGE_MIME = new Set(['image/jpeg', 'image/png'])
const VIDEO_MIME = new Set(['video/mp4', 'video/x-msvideo', 'video/avi'])

const MAX_IMAGE_BYTES = 10 * 1024 * 1024   // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024  // 100 MB

/* Simulated upload: completes in 1500–2500 ms */
const UPLOAD_MIN_MS = 1500
const UPLOAD_MAX_MS = 2500
const TICK_MS = 60

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtension(name) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function validateFile(file) {
  const ext = fileExtension(file.name)
  const mimeOk = ALLOWED_MIME.has(file.type)
  const extOk = ALLOWED_EXT.has(ext)

  if (!mimeOk && !extOk) {
    return { ok: false, reason: 'Unsupported file type' }
  }

  const isImage = IMAGE_MIME.has(file.type) || ['.jpg', '.jpeg', '.png'].includes(ext)
  const isVideo = VIDEO_MIME.has(file.type) || ['.mp4', '.avi'].includes(ext)

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `Image exceeds 10 MB (${formatBytes(file.size)})` }
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false, reason: `Video exceeds 100 MB (${formatBytes(file.size)})` }
  }

  return { ok: true, reason: null }
}

function makeEntry(file) {
  const { ok, reason } = validateFile(file)
  const ext = fileExtension(file.name)
  const isImage = IMAGE_MIME.has(file.type) || ['.jpg', '.jpeg', '.png'].includes(ext)

  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size,
    ext,
    isImage,
    objectUrl: isImage && ok ? URL.createObjectURL(file) : null,
    status: ok ? 'uploading' : 'rejected', // 'uploading' | 'done' | 'rejected'
    progress: 0,
    rejectedReason: reason,
  }
}

/* ─────────────────────────────────────────────
   SVG icons (inline — no extra dependency)
───────────────────────────────────────────── */

function IconUploadCloud() {
  return (
    <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function IconFilm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   FileRow component
───────────────────────────────────────────── */

function FileRow({ entry, onRemove }) {
  return (
    <li className="file-row">
      {/* Preview */}
      <div className="file-preview">
        {entry.isImage && entry.objectUrl ? (
          <img src={entry.objectUrl} alt={entry.name} />
        ) : (
          <div className="file-preview-icon">
            <IconFilm />
            <span className="file-ext">{entry.ext.replace('.', '')}</span>
          </div>
        )}
      </div>

      {/* Name + size */}
      <div className="file-info">
        <div className="file-name" title={entry.name}>{entry.name}</div>
        <div className="file-size mono">{formatBytes(entry.size)}</div>
      </div>

      {/* Progress / status */}
      <div className="file-progress-wrap">
        {entry.status === 'rejected' ? (
          <span className="file-rejected-tag" title={entry.rejectedReason}>
            Rejected — {entry.rejectedReason}
          </span>
        ) : entry.status === 'done' ? (
          <span className="file-done-tag">
            <IconCheck />
            Done
          </span>
        ) : (
          <>
            <div className="file-progress-header">
              <span className="file-progress-label">Uploading…</span>
              <span className="file-progress-pct mono">{entry.progress}%</span>
            </div>
            <div className="file-bar">
              <div className="file-bar-fill" style={{ width: `${entry.progress}%` }} />
            </div>
          </>
        )}
      </div>

      {/* Remove */}
      <button
        className="file-remove-btn"
        onClick={() => onRemove(entry.id)}
        title="Remove file"
        type="button"
      >
        <IconX />
      </button>
    </li>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */

export default function UploadPage() {
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)

  const inputRef = useRef(null)
  // Map of id → intervalId for active upload simulations
  const timersRef = useRef({})

  /* ── Cleanup all timers + object URLs on unmount ── */
  useEffect(() => {
    return () => {
      // Clear all active intervals
      Object.values(timersRef.current).forEach(clearInterval)
      // Revoke all object URLs still held
      setFiles((prev) => {
        prev.forEach((e) => {
          if (e.objectUrl) URL.revokeObjectURL(e.objectUrl)
        })
        return prev
      })
    }
  }, [])

  /* ── Start simulated upload for one entry ── */
  const startUpload = useCallback((id) => {
    const durationMs = UPLOAD_MIN_MS + Math.random() * (UPLOAD_MAX_MS - UPLOAD_MIN_MS)
    const totalTicks = Math.ceil(durationMs / TICK_MS)
    let tick = 0

    const intervalId = setInterval(() => {
      tick++
      const rawPct = tick / totalTicks
      // Ease-out: fast start, slows near 100
      const pct = Math.round(100 * (1 - Math.pow(1 - rawPct, 2.2)))
      const clamped = Math.min(pct, 100)

      setFiles((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e
          if (clamped >= 100) {
            return { ...e, progress: 100, status: 'done' }
          }
          return { ...e, progress: clamped }
        })
      )

      if (tick >= totalTicks) {
        clearInterval(intervalId)
        delete timersRef.current[id]
      }
    }, TICK_MS)

    timersRef.current[id] = intervalId
  }, [])

  /* ── Add files (merge, deduplicate by name+size) ── */
  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList)
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((e) => `${e.name}|${e.size}`))
      const newEntries = incoming
        .filter((f) => !existingKeys.has(`${f.name}|${f.size}`))
        .map(makeEntry)

      // Start timers for accepted files
      newEntries.forEach((entry) => {
        if (entry.status === 'uploading') {
          startUpload(entry.id)
        }
      })

      return [...prev, ...newEntries]
    })
  }, [startUpload])

  /* ── Remove a file ── */
  const removeFile = useCallback((id) => {
    // Cancel its timer if still running
    if (timersRef.current[id]) {
      clearInterval(timersRef.current[id])
      delete timersRef.current[id]
    }
    setFiles((prev) => {
      const entry = prev.find((e) => e.id === id)
      if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
      return prev.filter((e) => e.id !== id)
    })
  }, [])

  /* ── Drag handlers ── */
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear drag-over when leaving the zone itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
    }
  }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  /* ── Input change handler ── */
  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      // Reset so the same file can be re-added after removal
      e.target.value = ''
    }
  }

  /* ── Click-to-browse ── */
  const handleZoneClick = () => {
    inputRef.current?.click()
  }

  /* ── Counts for badge ── */
  const acceptedCount = files.filter((e) => e.status !== 'rejected').length

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1>Upload</h1>
          <p>Upload traffic footage for smoke detection.</p>
        </div>
      </div>

      {/* ── Hidden file input ── */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,video/mp4,video/x-msvideo,.jpg,.jpeg,.png,.mp4,.avi"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* ── Dropzone ── */}
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        onClick={handleZoneClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? handleZoneClick() : undefined}
        aria-label="Upload zone — click or drag files here"
      >
        <IconUploadCloud />
        <div className="dropzone-title">Drag &amp; drop files here</div>
        <div className="dropzone-sub">or <span style={{ textDecoration: 'underline', color: 'var(--text)' }}>click to browse</span></div>
        <div className="dropzone-hint">
          Accepted: JPEG, PNG (max 10 MB) · MP4, AVI (max 100 MB)
        </div>
      </div>

      {/* ── Upload actions row ── */}
      {files.length > 0 && (
        <div className="upload-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              // Clear all timers
              Object.values(timersRef.current).forEach(clearInterval)
              timersRef.current = {}
              // Revoke all object URLs
              files.forEach((e) => {
                if (e.objectUrl) URL.revokeObjectURL(e.objectUrl)
              })
              setFiles([])
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Files card ── */}
      <div className="files-card">
        <div className="files-head card-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
          <h3>
            Files
            <span className="file-count-badge mono">{acceptedCount}</span>
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="files-empty">No files added yet.</div>
        ) : (
          <ul className="file-list">
            {files.map((entry) => (
              <FileRow
                key={entry.id}
                entry={entry}
                onRemove={removeFile}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
