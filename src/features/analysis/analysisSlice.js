import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  severity: {
    total: 248,
    items: [
      { key: 'low',  label: 'Low',      value: 149, pct: 60, color: '#4ade80' },
      { key: 'mod',  label: 'Moderate', value: 67,  pct: 27, color: '#fbbf24' },
      { key: 'high', label: 'High',     value: 32,  pct: 13, color: '#f87171' },
    ],
  },
  settings: {
    model: 'yolov8-2.3',
    frameSampling: 'every5',
    sensitivity: 68,
    autoPdf: true,
    plateRedaction: true,
    nightMode: false,
  },
}

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    setSetting(state, action) {
      const { key, value } = action.payload
      state.settings[key] = value
    },
  },
})

export const { setSetting } = analysisSlice.actions
export default analysisSlice.reducer
