import { createSlice } from '@reduxjs/toolkit'

/*
 * Upload-queue state — SINGLE SOURCE OF TRUTH for the upload queue widget,
 * shared between the Upload page and the Dashboard.
 *
 * Every item MUST be fully serializable (no File objects). Only the derived
 * fields below are stored; the raw File is consumed at the call site to build
 * `previewUrl` and to drive the simulated upload progress.
 *
 * Item shape:
 *   { id, name, size, type, previewUrl, progress, status, sub, error }
 *     id         crypto.randomUUID()
 *     name       file name
 *     size       bytes (number)
 *     type       mime string
 *     previewUrl object-URL string for images, else null
 *     progress   0–100
 *     status     'uploading' | 'done' | 'rejected'
 *     sub        status text
 *     error      rejection reason (string) or null
 */

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
      state.items = state.items.filter((i) => i.id !== id)
    },
    clearAll(state) {
      state.items = []
    },
  },
})

export const { addFiles, updateProgress, setStatus, removeFile, clearAll } =
  uploadSlice.actions
export default uploadSlice.reducer
