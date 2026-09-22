import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select'
import { Slider } from '../components/ui/slider'
import { Switch } from '../components/ui/switch'
import Spinner from '../components/ui/Spinner'
import UploadQueue from '../components/UploadQueue'
import { setSetting, startAnalysis } from '../features/analysis/analysisSlice'
import { addFiles as addFilesAction, uploadFile } from '../features/upload/uploadSlice'
import { fetchSettings } from '../features/settings/settingsSlice'
import { pushToast } from '../features/ui/uiSlice'

/* ─────────────────────────────────────────────
   Constants & validation — the hardcoded lists below are ONLY the fallback
   used while /api/settings hasn't loaded yet (or couldn't load at all); once
   it has, the live allowed_image_formats / allowed_video_formats /
   max_upload_mb drive validation and the dropzone hint text.
───────────────────────────────────────────── */

const FALLBACK_IMAGE_FORMATS = ['jpg', 'jpeg', 'png']
const FALLBACK_VIDEO_FORMATS = ['mp4', 'avi', 'mov']
// A conservative guess (matches the API contract's own documented default),
// not an optimistic one — advertising a limit the server doesn't actually
// honour just means the operator waits out an entire doomed upload before
// finding out. Only ever used when the real limit truly could not be read.
const FALLBACK_MAX_MB = 512

function fileExt(name) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function fmtLimit(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  return `${mb} MB`
}

function validateFile(file, { formats, maxBytes, maxMb }) {
  const ext = fileExt(file.name)
  if (!formats.includes(ext)) return 'Unsupported file type'
  if (file.size > maxBytes) return `Exceeds ${fmtLimit(maxMb)} limit`
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
  const [starting, setStarting] = useState(false)

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const settings = useSelector((s) => s.analysis.settings)
  const queueItems = useSelector((s) => s.upload.items)
  const liveSettings = useSelector((s) => s.settings.data)
  const liveSettingsStatus = useSelector((s) => s.settings.status)
  const liveSettingsError = useSelector((s) => s.settings.error)
  const { frameSampling, sensitivity, autoPdf } = settings

  const inputRef = useRef(null)

  // Pull the live upload limits once on mount; UploadPage always wants a
  // fresh read since limits are admin-configurable.
  useEffect(() => {
    dispatch(fetchSettings())
  }, [dispatch])

  // The fetch genuinely failed and nothing was ever cached — the limits
  // below are the conservative fallback, not a confirmed value, and the UI
  // says so rather than presenting a guess as fact.
  const limitsUnknown = !liveSettings && liveSettingsStatus === 'rejected'

  const limits = useMemo(() => {
    const imageFormats = liveSettings?.allowed_image_formats || FALLBACK_IMAGE_FORMATS
    const videoFormats = liveSettings?.allowed_video_formats || FALLBACK_VIDEO_FORMATS
    const maxMb = liveSettings?.max_upload_mb || FALLBACK_MAX_MB
    return {
      formats: [...imageFormats, ...videoFormats].map((f) => f.toLowerCase()),
      imageFormats,
      videoFormats,
      maxMb,
      maxBytes: maxMb * 1024 * 1024,
    }
  }, [liveSettings])

  const acceptAttr = useMemo(
    () => limits.formats.map((f) => `.${f}`).join(','),
    [limits.formats]
  )

  /* ── Add files → build serializable items, push to Redux, start real upload ── */
  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList)
      // Grows as we walk `incoming`, so two files in the SAME selection that
      // happen to share a name+size (e.g. two cameras' identically-sized
      // clips, both literally named clip.mp4) are caught too, not just
      // duplicates of something already in the queue.
      const seenKeys = new Set(queueItems.map((i) => `${i.name}|${i.size}`))
      const skippedNames = []

      incoming.forEach((f) => {
        const key = `${f.name}|${f.size}`
        const id = crypto.randomUUID()

        if (seenKeys.has(key)) {
          // Surfaced explicitly — silently dropping this meant the second
          // camera's footage was never analysed, with nothing to notice.
          skippedNames.push(f.name)
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
                error: 'Duplicate — a file with this name and size is already in the queue.',
                media_id: null,
              },
            ])
          )
          return
        }
        seenKeys.add(key)

        const error = validateFile(f, limits)
        const isImage = f.type === 'image/jpeg' || f.type === 'image/png'

        if (error) {
          // Rejected client-side — no preview, no upload attempt.
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
                media_id: null,
              },
            ])
          )
          return
        }

        // Valid — derive serializable fields only (never store the File in Redux).
        const item = {
          id,
          name: f.name,
          size: f.size,
          type: f.type,
          previewUrl: isImage ? URL.createObjectURL(f) : null,
          progress: 0,
          status: 'queued',
          sub: 'Waiting to upload…',
          error: null,
          media_id: null,
        }
        dispatch(addFilesAction([item]))
        dispatch(uploadFile({ file: f, clientId: id }))
      })

      if (skippedNames.length === 1) {
        dispatch(pushToast({
          message: `Skipped "${skippedNames[0]}" — a file with the same name and size is already in the queue.`,
          variant: 'error',
        }))
      } else if (skippedNames.length > 1) {
        dispatch(pushToast({
          message: `Skipped ${skippedNames.length} files already in the queue (same name and size).`,
          variant: 'error',
        }))
      }
    },
    [dispatch, queueItems, limits]
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

  // ready files = fully-uploaded rows with a server media_id
  const uploadedItems = queueItems.filter((i) => i.status === 'uploaded' && i.media_id)
  const readyCount = uploadedItems.length

  const handleStartAnalysis = async () => {
    if (readyCount === 0 || starting) return
    setStarting(true)
    try {
      const results = await Promise.all(
        uploadedItems.map((item) => dispatch(startAnalysis({ media_id: item.media_id, settings })))
      )
      const succeeded = results.filter((r) => startAnalysis.fulfilled.match(r))
      const failedCount = results.length - succeeded.length
      if (failedCount > 0) {
        dispatch(
          pushToast({
            message: `${failedCount} of ${results.length} analyses failed to start.`,
            variant: 'error',
          })
        )
      }
      if (succeeded.length === 1) {
        navigate(`/analysis/${succeeded[0].payload.analysis_id}`)
      } else if (succeeded.length > 1) {
        dispatch(pushToast({ message: `Started ${succeeded.length} analyses.`, variant: 'success' }))
        navigate('/analysis')
      }
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col xl:h-full">
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
        accept={acceptAttr}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_372px] gap-4 xl:flex-1 xl:min-h-0">
        {/* ── LEFT column ── */}
        <div className="flex flex-col min-h-0">
          {limitsUnknown && (
            <div role="alert" className="card mb-4 px-4 py-3 text-[12px] text-mod border border-mod/30 bg-mod-bg">
              Upload limits could not be loaded{liveSettingsError ? ` (${liveSettingsError})` : ''} — showing a
              conservative {fmtLimit(FALLBACK_MAX_MB)} estimate until this is confirmed. Large files may still be
              rejected by the server.{' '}
              <button type="button" className="link" style={{ color: 'inherit' }} onClick={() => dispatch(fetchSettings())}>
                Retry
              </button>
            </div>
          )}

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
                'border-[1.5px] border-dashed rounded-[11px] flex flex-col items-center justify-center h-[220px] sm:h-[260px] xl:h-[300px] px-4 text-center transition-[border-color,background] duration-150 ease-out ' +
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
                {limits.formats.map((f) => (
                  <span key={f} className="text-[10.5px] font-semibold tracking-[0.04em] border border-line-2 rounded-[6px] py-1 px-[9px] text-text-2">
                    {f.toUpperCase()}
                  </span>
                ))}
                <em className="not-italic text-[11.5px] text-muted ml-1">· up to {fmtLimit(limits.maxMb)}</em>
              </div>
            </div>
          </div>

          {/* Upload queue — shared, Redux-backed widget */}
          <UploadQueue className="mt-4 min-h-[200px] xl:flex-1 xl:min-h-0" />
        </div>

        {/* ── RIGHT column — Analysis settings ── */}
        <div className="flex flex-col min-h-0">
        <div className="card">
          <div className="card-head">
            <h3>Analysis settings</h3>
          </div>
          <div className="pt-1.5 pb-[18px] px-[18px]">
            {/* Only one detection model actually runs server-side — a
                multi-option select implied a choice that did not exist
                (every option silently ran the same model). Shown as a
                plain, accurately-labelled read-out instead of a fake
                picker. */}
            <label id="detection-model-label" className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Detection model</label>
            <div
              aria-labelledby="detection-model-label"
              className="h-9 flex items-center rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text-2"
            >
              YOLO11n
            </div>
            <p className="text-[11px] text-muted mt-1.5">Only one detection model is currently available.</p>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Smoke sensitivity</label>
            <div className="pt-1.5 px-0.5">
              <Slider
                value={[sensitivity]}
                onValueChange={(v) => dispatch(setSetting({ key: 'sensitivity', value: v[0] }))}
                min={0}
                max={100}
                step={1}
                aria-label="Smoke sensitivity"
              />
              <div className="flex justify-between text-[10.5px] text-muted mt-[9px]">
                <span>Low</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
              <p className="text-[11px] text-muted mt-1.5">
                Stricter requires higher-confidence, more visually distinct smoke before flagging a
                detection — fewer results, fewer false positives.
              </p>
            </div>

            <label className="block text-[12.5px] font-[560] text-[#d4d4d4] mt-4 mb-2">Frame sampling</label>
            <Select value={frameSampling} onValueChange={(v) => dispatch(setSetting({ key: 'frameSampling', value: v }))}>
              <SelectTrigger aria-label="Frame sampling">
                <SelectValue placeholder="Select sampling" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="every1">Every frame</SelectItem>
                <SelectItem value="every5">Every 5th frame</SelectItem>
                <SelectItem value="every10">Every 10th frame</SelectItem>
              </SelectContent>
            </Select>

            {/* License plate redaction / night-mode enhancement toggles were
                removed — they were never implemented server-side (silently
                dropped by the settings→API mapping), so they looked live
                but did nothing. Only the toggle that actually has an effect
                remains. */}
            <div className="mt-[22px] flex flex-col gap-[15px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-[12.5px] font-[550] block">Auto-generate PDF report</b>
                  <span className="text-[11px] text-muted">Create report when analysis completes</span>
                </div>
                <Switch checked={autoPdf} onCheckedChange={(v) => dispatch(setSetting({ key: 'autoPdf', value: v }))} aria-label="Auto-generate PDF report" />
              </div>
            </div>

            <button
              className="btn btn-pri w-full h-[42px] justify-center mt-[22px] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={readyCount === 0 || starting}
              onClick={handleStartAnalysis}
            >
              {starting && <Spinner size={14} />}
              {starting ? 'Starting…' : 'Start analysis'}
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
