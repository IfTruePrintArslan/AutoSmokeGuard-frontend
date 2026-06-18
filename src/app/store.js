import { configureStore } from '@reduxjs/toolkit'
import uiReducer from '../features/ui/uiSlice'
import authReducer from '../features/auth/authSlice'
import analysisReducer from '../features/analysis/analysisSlice'

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    analysis: analysisReducer,
  },
})

export default store
