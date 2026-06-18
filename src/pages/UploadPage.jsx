import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select'
import { Slider } from '../components/ui/slider'
import { Switch } from '../components/ui/switch'
import UploadQueue from '../components/UploadQueue'
import { setSetting } from '../features/analysis/analysisSlice'
import {
  addFiles as addFilesAction,
  updateProgress,
  setStatus,
} from '../features/upload/uploadSlice'

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
const UPLOAD_DURATION_MS = 2000 // ~2 s simulated upload

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

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false)

  // analysis settings — global Redux state
  const dispatch = useDispatch()
  const settings = useSelector((s) => s.analysis.settings)
  const queueItems = useSelector((s) => s.upload.items)
  const {
    model,
    frameSampling,
    sensitivity,
    autoPdf,
    plateRedaction,
    nightMode,
  } = settings

  const inputRef  = useRef(null)
  const timersRef = useRef({})

  /* ── Cleanup on unmount — clear any running upload timers ── */
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval)
      timersRef.current = {}
    }
  }, [])

  /* ── Simulated upload progress → Redux ── */
  const startUpload = useCallback(
    (id) => {
      const totalTicks = Math.ceil(UPLOAD_DURATION_MS / TICK_MS)
      let tick = 0

      const iid = setInterval(() => {
        tick++
        const raw = tick / totalTicks
        const pct = Math.min(Math.round(100 * (1 - Math.pow(1 - raw, 2))), 100)

        if (pct >= 100) {
          dispatch(updateProgress({ id, progress: 100, sub: 'Uploading… 100%' }))
          dispatch(setStatus({ id, status: 'done', sub: 'Uploaded · ready for analysis' }))
          clearInterval(iid)
          delete timersRef.current[id]
          return
        }

        dispatch(updateProgress({ id, progress: pct, sub: `Uploading… ${pct}%` }))

        if (tick >= totalTicks) {
          clearInterval(iid)
          delete timersRef.current[id]
        }
      }, TICK_MS)

      timersRef.current[id] = iid
    },
    [dispatch]
  )

  /* ── Add files → build serializable items, push to Redux ── */
  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList)
      const existingKeys = new Set(queueItems.map((i) => `${i.name}|${i.size}`))

      incoming
        .filter((f) => !existingKeys.has(`${f.name}|${f.size}`))
        .forEach((f) => {
          const id = crypto.randomUUID()
          const error = validateFile(f)
          const isImage = f.type === 'image/jpeg' || f.type === 'image/png'

          if (error) {
            // Rejected — no preview, no timer
            dispatch(
              addFilesAction([
                {
                  id,
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  previewUrl: null,
                  progress: 0,
                  status: 'rejected',
                  sub: '',
                  error,
                },
              ])
            )
            return
          }

          // Valid — derive serializable fields only (never store the File)
          const item = {
            id,
            name: f.name,
            size: f.size,
            type: f.type,
            previewUrl: isImage ? URL.createObjectURL(f) : null,
            progress: 0,
            status: 'uploading',
            sub: 'Uploading… 0%',
            error: null,
          }
          dispatch(addFilesAction([item]))
          startUpload(id)
        })
    },
    [dispatch, queueItems, startUpload]
  )

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

  // ready files = fully-uploaded rows
  const readyCount = queueItems.filter((i) => i.status === 'done').length

  return (
    <div className="flex flex-col lg:h-full">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_372px] gap-4 lg:flex-1 lg:min-h-0">
        {/* ── LEFT column ── */}
        <div className="flex flex-col min-h-0">
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
                'border-[1.5px] border-dashed rounded-[11px] flex flex-col items-center justify-center h-[220px] sm:h-[260px] lg:h-[300px] px-4 text-center transition-[border-color,background] duration-150 ease-out ' +
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
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">MP4</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">AVI</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">MOV</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">JPEG</span>
                <span className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">PNG</span>
                <em className="not-italic text-[11.5px] text-muted ml-1">· up to 2 GB</em>
              </div>
            </div>
          </div>

          {/* Upload queue — shared, Redux-backed widget */}
          <UploadQueue className="mt-4 min-h-[200px] lg:flex-1 lg:min-h-0" />
        </div>

        {/* ── RIGHT column — Analysis settings ── */}
        <div className="flex flex-col min-h-0">
        <div className="card">
          <div className="card-head">
            <h3>Analysis settings</h3>
          </div>
          <div className="pt-1.5 pb-[18px] px-[18px]">
            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Detection model</label>
            <Select value={model} onValueChange={(v) => dispatch(setSetting({ key: 'model', value: v }))}>
              <SelectTrigger aria-label="Detection model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yolov8-2.3">YOLOv8-seg · v2.3</SelectItem>
                <SelectItem value="yolov11-3.0">YOLOv11-seg · v3.0</SelectItem>
                <SelectItem value="rtdetr-1.2">RT-DETR · v1.2</SelectItem>
              </SelectContent>
            </Select>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Smoke sensitivity</label>
            <div className="pt-1.5 px-0.5">
              <Slider
                value={[sensitivity]}
                onValueChange={(v) => dispatch(setSetting({ key: 'sensitivity', value: v[0] }))}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-[10.5px] text-muted mt-[9px]">
                <span>Low</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
            </div>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Frame sampling</label>
            <Select value={frameSampling} onValueChange={(v) => dispatch(setSetting({ key: 'frameSampling', value: v }))}>
              <SelectTrigger aria-label="Frame sampling">
                <SelectValue placeholder="Select sampling" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="every">Every frame</SelectItem>
                <SelectItem value="every5">Every 5th frame</SelectItem>
                <SelectItem value="every10">Every 10th frame</SelectItem>
                <SelectItem value="every30">Every 30th frame</SelectItem>
              </SelectContent>
            </Select>

            <div className="mt-[22px] flex flex-col gap-[15px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">Auto-generate PDF report</b>
                  <span className="text-[11px] text-muted">Create report when analysis completes</span>
                </div>
                <Switch checked={autoPdf} onCheckedChange={(v) => dispatch(setSetting({ key: 'autoPdf', value: v }))} aria-label="Auto-generate PDF report" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">License plate redaction</b>
                  <span className="text-[11px] text-muted">Blur plates in exported frames</span>
                </div>
                <Switch checked={plateRedaction} onCheckedChange={(v) => dispatch(setSetting({ key: 'plateRedaction', value: v }))} aria-label="License plate redaction" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">Night-mode enhancement</b>
                  <span className="text-[11px] text-muted">Boost contrast for low-light footage</span>
                </div>
                <Switch checked={nightMode} onCheckedChange={(v) => dispatch(setSetting({ key: 'nightMode', value: v }))} aria-label="Night-mode enhancement" />
              </div>
            </div>

            <button
              className="btn btn-pri w-full h-[42px] justify-center mt-[22px] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={readyCount === 0}
              onClick={() =>
                alert(
                  `Starting analysis on ${readyCount} file${readyCount !== 1 ? 's' : ''}.`
                )
              }
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
      </div>
    </div>
  )
}
