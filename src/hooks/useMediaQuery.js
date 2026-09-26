import { useSyncExternalStore } from 'react'

function getMql(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null
}

function subscribe(query, onStoreChange) {
  const mql = getMql(query)
  if (!mql) return () => {}
  if (mql.addEventListener) mql.addEventListener('change', onStoreChange)
  else mql.addListener(onStoreChange)
  return () => {
    if (mql.removeEventListener) mql.removeEventListener('change', onStoreChange)
    else mql.removeListener(onStoreChange)
  }
}

// Tracks whether a CSS media query currently matches, updating live as the
// viewport crosses the breakpoint (resize, devtools device toggle, etc.) —
// used where a layout decision (e.g. "is the sidebar in off-canvas drawer
// mode?") has to be made in JS to drive an ARIA/DOM attribute that CSS alone
// cannot express (see `inert` on the mobile nav drawer). Built on
// `useSyncExternalStore` — the correct primitive for subscribing to an
// external source of truth like `matchMedia`, rather than mirroring it into
// local state from inside an effect.
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => getMql(query)?.matches ?? false,
    () => false
  )
}
