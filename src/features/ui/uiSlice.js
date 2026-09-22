import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen: true,
  // Mobile off-canvas drawer (only relevant below lg). Closed by default.
  mobileNavOpen: false,
  // Rail collapse — only applies at ≥769px in-flow sidebar; ignored on mobile drawer.
  sidebarCollapsed: false,
  // Global toast queue, rendered by <Toaster/> in AppLayout.
  toasts: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    openMobileNav(state) {
      state.mobileNavOpen = true
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false
    },
    toggleMobileNav(state) {
      state.mobileNavOpen = !state.mobileNavOpen
    },
    toggleSidebarCollapse(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    pushToast: {
      reducer(state, action) {
        state.toasts.push(action.payload)
      },
      prepare({ message, variant = 'info', duration = 4000 } = {}) {
        return { payload: { id: crypto.randomUUID(), message, variant, duration } }
      },
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
})

export const {
  toggleSidebar,
  openMobileNav,
  closeMobileNav,
  toggleMobileNav,
  toggleSidebarCollapse,
  pushToast,
  dismissToast,
} = uiSlice.actions
export default uiSlice.reducer
