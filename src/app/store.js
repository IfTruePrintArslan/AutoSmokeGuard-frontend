import { configureStore } from '@reduxjs/toolkit'
import uiReducer from '../features/ui/uiSlice'
import authReducer from '../features/auth/authSlice'

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
  },
})

export default store
