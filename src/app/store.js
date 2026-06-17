import { configureStore } from '@reduxjs/toolkit'
import uiReducer from '../features/ui/uiSlice'

// Auth slice will be added in a later task — reserve the 'auth' key here.
const store = configureStore({
  reducer: {
    ui: uiReducer,
    // auth: authReducer,  <-- placeholder for future authSlice
  },
})

export default store
