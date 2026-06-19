import { useSelector, useDispatch } from 'react-redux'
import { removeFile } from '../features/upload/uploadSlice'

/* ─────────────────────────────────────────────
   Size formatting — KB / MB (omit when 0)
───────────────────────────────────────────── */
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/* ─────────────────────────────────────────────
   Inline SVG icons
───────────────────────────────────────────── */
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   FileRow — renders one queue item
───────────────────────────────────────────── */
function FileRow({ item, onRemove }) {
  const { status, previewUrl } = item

  return (
    <div className="flex gap-3.5 items-start">
      {/* icon / thumbnail */}
      <div
        className={
          'w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center mt-0.5 relative overflow-hidden' +
          (status === 'done' ? ' bg-low-bg text-low' : '') +
          (status === 'uploading' ? ' bg-accent-glow' : '') +
          (status === 'rejected' ? ' bg-[rgba(148,163,184,0.1)] text-muted' : '')
        }
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : status === 'done' ? (
          <IconCheck />
        ) : status === 'uploading' ? (
          <span className="block w-[14px] h-[14px] rounded-[99px] border-[2.5px] border-white/25 border-t-accent animate-spin [animation-duration:0.7s]" />
        ) : (
          <IconFile />
        )}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2 text-[13px]">
          <b className="font-[550] truncate">{item.name}</b>
          <span className="mono text-muted text-[12px] shrink-0">{fmtSize(item.size)}</span>
        </div>

        {status === 'rejected' ? (
          <div className="text-[11.5px] text-high mt-1">Rejected — {item.error}</div>
        ) : status === 'done' ? (
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-[11.5px] text-muted">{item.sub}</div>
            <span className="text-[10.5px] font-semibold py-0.5 px-[7px] rounded-[99px] text-low bg-low-bg shrink-0">Done</span>
          </div>
        ) : (
          <>
            <div className="h-1.5 rounded-[99px] bg-[rgba(148,163,184,0.12)] mt-2 mb-1.5 overflow-hidden">
              <i
                className="block h-full rounded-[99px] bg-[#e5e5e5] transition-[width] duration-[120ms] ease-linear"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <div className="text-[11.5px] text-muted">{item.sub}</div>
          </>
        )}
      </div>

      {/* remove */}
      <button
        className="w-[28px] h-[28px] flex-shrink-0 self-center inline-flex items-center justify-center bg-transparent border border-line-2 text-muted cursor-pointer text-[15px] leading-none rounded-[7px] transition-colors font-sans hover:text-high hover:border-high hover:bg-high-bg"
        type="button"
        title="Remove"
        aria-label={`Remove ${item.name}`}
        onClick={() => onRemove(item)}
      >
        <IconClose />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   UploadQueue — shared, Redux-backed widget
───────────────────────────────────────────── */
export default function UploadQueue({ className = '' }) {
  const items = useSelector((s) => s.upload.items)
  const dispatch = useDispatch()

  // Count + total only over non-rejected files
  const active = items.filter((i) => i.status !== 'rejected')
  const fileCount = active.length
  const totalBytes = active.reduce((acc, i) => acc + (i.size || 0), 0)

  const handleRemove = (item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    dispatch(removeFile(item.id))
  }

  return (
    <div className={`card flex flex-col min-h-0 ${className}`}>
      <div className="card-head shrink-0">
        <h3>Upload queue</h3>
        <span className="text-[12px] text-text-2">
          {fileCount} file{fileCount !== 1 ? 's' : ''}
          {totalBytes > 0 ? ` · ${fmtSize(totalBytes)}` : ''}
        </span>
      </div>
      <div className="pt-2 pb-4 px-[18px] flex flex-col gap-4 overflow-y-auto flex-1">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-muted py-10">
            No files added yet.
          </div>
        ) : (
          items.map((item) => (
            <FileRow key={item.id} item={item} onRemove={handleRemove} />
          ))
        )}
      </div>
    </div>
  )
}
