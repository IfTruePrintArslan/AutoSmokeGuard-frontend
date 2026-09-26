import { configureStore } from '@reduxjs/toolkit'
import uiReducer from '../features/ui/uiSlice'
import authReducer from '../features/auth/authSlice'
import analysisReducer from '../features/analysis/analysisSlice'
import uploadReducer from '../features/upload/uploadSlice'
import historyReducer from '../features/history/historySlice'
import dashboardReducer from '../features/dashboard/dashboardSlice'
import settingsReducer from '../features/settings/settingsSlice'

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    analysis: analysisReducer,
    upload: uploadReducer,
    history: historyReducer,
    dashboard: dashboardReducer,
    settings: settingsReducer,
  },
})

export default store
