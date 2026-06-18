import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen: true,
  // Mobile off-canvas drawer (only relevant below lg). Closed by default.
  mobileNavOpen: false,
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
  },
})

export const {
  toggleSidebar,
  openMobileNav,
  closeMobileNav,
  toggleMobileNav,
} = uiSlice.actions
export default uiSlice.reducer
