import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen: true,
  // Mobile off-canvas drawer (only relevant below lg). Closed by default.
  mobileNavOpen: false,
  // Rail collapse — only applies at ≥769px in-flow sidebar; ignored on mobile drawer.
  sidebarCollapsed: false,
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
  },
})

export const {
  toggleSidebar,
  openMobileNav,
  closeMobileNav,
  toggleMobileNav,
  toggleSidebarCollapse,
} = uiSlice.actions
export default uiSlice.reducer
