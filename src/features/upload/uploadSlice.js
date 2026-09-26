import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiUpload, ApiError } from '../../lib/api'

/*
 * Upload-queue state — SINGLE SOURCE OF TRUTH for the upload queue widget,
 * shared between the Upload page and the Dashboard.
 *
 * Every item MUST be fully serializable (no File objects, no
 * AbortControllers — those live in the module-level maps below, keyed by
 * the item's client id, so they survive route navigation for the life of
 * the SPA session without polluting Redux state).
 *
 * Item shape:
 *   { id, name, size, type, previewUrl, progress, status, sub, error, media_id }
 *     id         crypto.randomUUID() — the "clientId"
 *     name       file name
 *     size       bytes (number)
 *     type       mime string
 *     previewUrl object-URL string for images, else null
 *     progress   0–100
 *     status     'queued' | 'uploading' | 'uploaded' | 'rejected'
 *     sub        status text
 *     error      rejection reason (string) or null
 *     media_id   server-assigned MediaObj id once uploaded, else null
 */

const controllers = new Map()
const fileCache = new Map()

export function getClientFile(clientId) {
  return fileCache.get(clientId) || null
}

export function cancelUpload(clientId) {
  controllers.get(clientId)?.abort()
}

export function cancelAllUploads() {
  controllers.forEach((c) => c.abort())
}

// Server-side upload validation failure codes -> friendly messages.
const ERROR_MESSAGES = {
  invalid_format: 'Unsupported file format.',
  file_too_large: 'File exceeds the maximum upload size.',
  corrupt_file: 'File appears to be corrupt or unreadable.',
  empty_file: 'File is empty.',
  video_too_long: 'Video exceeds the maximum allowed duration.',
}

function friendlyUploadError(err) {
  if (err instanceof ApiError) {
    return { detail: ERROR_MESSAGES[err.code] || err.detail, code: err.code }
  }
  return { detail: err?.message || 'Upload failed.', code: null }
}

export const uploadFile = createAsyncThunk(
  'upload/uploadFile',
  async ({ file, clientId }, { dispatch, rejectWithValue }) => {
    const controller = new AbortController()
    controllers.set(clientId, controller)
    fileCache.set(clientId, file)
    try {
      const media = await apiUpload('/api/upload', file, {}, {
        signal: controller.signal,
        onProgress: (pct) => dispatch(updateProgress({ id: clientId, progress: pct, sub: `Uploading… ${pct}%` })),
      })
      return { clientId, media }
    } catch (err) {
      if (err?.name === 'AbortError') {
        return rejectWithValue({ clientId, aborted: true })
      }
      return rejectWithValue({ clientId, ...friendlyUploadError(err) })
    } finally {
      controllers.delete(clientId)
    }
  }
)

const initialState = {
  items: [],
}

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    addFiles(state, action) {
      // payload: array of serializable item objects
      state.items.push(...action.payload)
    },
    updateProgress(state, action) {
      const { id, progress, sub } = action.payload
      const item = state.items.find((i) => i.id === id)
      if (!item) return // NO-OP if id not found
      item.progress = progress
      if (sub !== undefined) item.sub = sub
    },
    setStatus(state, action) {
      const { id, status, sub } = action.payload
      const item = state.items.find((i) => i.id === id)
      if (!item) return
      item.status = status
      if (sub !== undefined) item.sub = sub
    },
    removeFile(state, action) {
      const id = action.payload
      controllers.get(id)?.abort()
      controllers.delete(id)
      fileCache.delete(id)
      state.items = state.items.filter((i) => i.id !== id)
    },
    clearAll(state) {
      cancelAllUploads()
      controllers.clear()
      fileCache.clear()
      state.items = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadFile.pending, (state, action) => {
        const { clientId } = action.meta.arg
        const item = state.items.find((i) => i.id === clientId)
        if (item) {
          item.status = 'uploading'
          item.progress = 0
          item.sub = 'Uploading… 0%'
          item.error = null
        }
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        const { clientId, media } = action.payload
        const item = state.items.find((i) => i.id === clientId)
        if (item) {
          item.status = 'uploaded'
          item.progress = 100
          item.sub = 'Uploaded · ready for analysis'
          item.media_id = media.media_id
          item.error = null
        }
      })
      .addCase(uploadFile.rejected, (state, action) => {
        const payload = action.payload || {}
        const clientId = payload.clientId ?? action.meta.arg.clientId
        const item = state.items.find((i) => i.id === clientId)
        if (!item) return
        item.status = 'rejected'
        item.progress = 0
        item.sub = ''
        item.error = payload.aborted ? 'Upload cancelled.' : (payload.detail || 'Upload failed.')
      })
  },
})

export const { addFiles, updateProgress, setStatus, removeFile, clearAll } =
  uploadSlice.actions
export default uploadSlice.reducer
