# AutoSmokeGuard — Frontend

React (Vite) single-page client for AutoSmokeGuard. This document covers the
frontend in isolation; see the [root README](../README.md) for the
one-command launcher and a whole-system view, and
[`API_CONTRACT.md`](../API_CONTRACT.md) for the exact request/response shapes
this client is built against.

## Screen inventory and routes

Routing is `react-router-dom` v7, defined in `src/App.jsx`. Every page except
`LoginPage` is route-level code-split with `React.lazy` + `Suspense`
(a spinner fallback renders while the chunk loads); `LoginPage` is loaded
eagerly since it is the most common landing page for an unauthenticated
visitor.

| Route | Page component | Protected? |
|---|---|---|
| `/login` | `LoginPage` | no |
| `/register` | `RegisterPage` | no |
| `/forgot-password` | `ForgotPasswordPage` | no |
| `/reset-password` | `ResetPasswordPage` | no |
| `/dashboard` | `DashboardPage` | yes |
| `/upload` | `UploadPage` | yes |
| `/analysis`, `/analysis/:analysisId` | `AnalysisPage` | yes |
| `/reports` | `ReportsPage` | yes |
| `/history` | `HistoryPage` | yes |
| `/settings` | `SettingsPage` | yes |
| `/` | redirects to `/dashboard` | — |
| `*` | `NotFoundPage` | — |

Protected routes are wrapped in `<ProtectedRoute>` (`components/auth/`,
bounces to `/login` when there is no token) and share `<AppLayout>`
(`components/layout/`: `Sidebar` + `Topbar` + the routed page + the global
toast queue).

## Redux slice map

`src/app/store.js` combines seven slices (`@reduxjs/toolkit`,
`configureStore`):

| Slice | File | Responsibility |
|---|---|---|
| `auth` | `features/auth/authSlice.js` | Login/register/logout/refresh, the current `user` object, hydrates from `localStorage` on load via `lib/tokens.js` |
| `upload` | `features/upload/uploadSlice.js` | The upload-queue widget's state — **single source of truth**, shared between the Upload page and the Dashboard. Per-item progress/status; `File` objects and `AbortController`s are kept in module-level maps keyed by client id (never put in Redux state, which must stay serializable) |
| `analysis` | `features/analysis/analysisSlice.js` | The user's last-run analysis settings; `detail.byId` cache of fetched `AnalysisDetail` objects; `polling` — live `StatusObj` snapshots keyed by `job_id`, powering the dashboard's processing queue and the analysis-in-progress UI |
| `history` | `features/history/historySlice.js` | The History screen's paginated rows, active filters (`severity`, `vehicle_type`, `status`, date range, `search`, `ordering`) and pagination state |
| `dashboard` | `features/dashboard/dashboardSlice.js` | The whole `GET /api/dashboard/stats` response, stored as-is |
| `settings` | `features/settings/settingsSlice.js` | The `SystemSetting` object (UC-09), separate `saveStatus` from `status` so a failed save doesn't blank an already-loaded settings screen |
| `ui` | `features/ui/uiSlice.js` | Sidebar open/collapsed state, the mobile off-canvas drawer, and the global toast queue |

Every async thunk follows the same pattern: call `lib/api.js`, catch
`ApiError`, and `rejectWithValue({ detail, code, errors })` so every slice's
`rejected` reducer and every page's error rendering look the same.

## `src/lib/api.js` — the API client contract

A thin `fetch` wrapper, not a generated client, so the shape of every call is
explicit at the call site.

- **`request(path, options)`** — the core JSON fetch. Adds
  `Authorization: Bearer <access>` when `auth !== false`, sets
  `Content-Type: application/json` unless the body is a `FormData`, and
  parses every response body defensively (a `204` or an empty body returns
  `null`; a non-JSON body is returned as text rather than throwing).
  `apiGet`/`apiPost`/`apiPatch`/`apiPut`/`apiDelete` are one-line wrappers
  around it.
- **Every failure becomes an `ApiError`** (`status`, `code`, `detail`,
  `errors`), constructed by normalising the backend's `{detail, code, errors}`
  envelope. `ApiError.fieldErrors` flattens `{field: [msg, ...]}` down to
  `{field: firstMsg}` for direct binding to form state.
- **Single-flight 401 refresh.** A `401` whose body carries
  `code: "token_not_valid"` triggers `refreshAccessToken()`. A module-level
  `refreshPromise` means N concurrent 401s (e.g. a page firing several
  requests at once) share exactly **one** `POST /api/refresh-token` call —
  the first caller starts it, every other caller awaits the same promise
  instead of racing separate refreshes. On success the retried request is
  replayed once (`_retried: true` guards against an infinite loop); on
  failure, tokens are cleared and a `window.dispatchEvent(new
  Event('asg:unauthorized'))` is fired so the app can react (bounce to
  `/login`) without `api.js` importing router code.
- **`apiUpload(path, file, fields, options)`** is `XMLHttpRequest`-based, not
  `fetch`-based, specifically because `fetch` cannot report upload progress.
  `xhr.upload.onprogress` drives `options.onProgress(percent)` for the
  upload-queue UI; it participates in the same single-flight-refresh-and-retry
  logic as `request()`, and honours an `AbortSignal` by calling `xhr.abort()`.
- **`apiDownload(path, filename)`** fetches an authenticated blob and drives
  a synthetic `<a download>` click to trigger the browser's save dialog —
  used for the PDF report download, since a plain `<a href>` cannot carry an
  `Authorization` header.
- **`mediaUrl(path)`** resolves a backend-relative media path
  (`/media/analysis/<id>/preview.jpg`) against `API_BASE` for `<img>`/`<a>`
  tags outside the fetch layer.

## Design tokens and the severity system

`src/index.css` defines the whole visual language as CSS custom properties
inside Tailwind v4 `@theme` blocks — colours (`--color-bg`, `--color-surface`,
`--color-text*`, `--color-high`/`--color-mod`/`--color-low` for severity),
the `Plus Jakarta Sans` variable font, and `--radius-card`. Repeated
structural chrome (`.page-head`, `.card`, `.card-head`, the `.sev*` badge
classes) is defined once under `@layer components`; anything page-specific
stays as inline Tailwind utilities in the JSX rather than growing the
stylesheet.

**`SeverityBadge` (`components/ui/SeverityBadge.jsx`) is the single owner of
the `moderate` → `sev-mod` mapping.** The backend's severity vocabulary is
`"low" | "moderate" | "high"` (see `API_CONTRACT.md`); the CSS classes are
`.sev-low` / `.sev-mod` / `.sev-high` — note `moderate` does **not** map to
`sev-moderate`. That translation lives in exactly one place,
`src/lib/severity.js` (`sevClass`, plus `sevLabel` and `sevColor` for the
matching display label and chart colour), and `SeverityBadge` is the only
component that should be rendering a severity pill. `lib/severity.js` also
exports `severityCountsToDistribution()`, which reshapes a raw
`{low, moderate, high}` count object (as returned on an `AnalysisRow`/
`AnalysisDetail`) into the same array shape the dashboard's
`severity_distribution` already arrives in, so `<SeverityDistribution>` can
render either source through one prop contract. Any new UI that needs to
show a severity value should import from `lib/severity.js` / render through
`SeverityBadge`, not re-derive the mapping locally.

## Environment variables

| Variable | Used in | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `lib/api.js` (`API_BASE`) | Absolute origin the client's `fetch`/`XHR` calls are built against. Set to `http://127.0.0.1:8000` in `.env.development`/`.env.example`; left empty in production so requests are same-origin |
| `VITE_API_PROXY` | `vite.config.js` (dev server `proxy` target) | Where the Vite dev server forwards `/api` and `/media`. Defaults to `http://127.0.0.1:8000`; the launcher (`start.py`) exports this when it has to move the Django API to a non-default port because 8000 was already taken |

**How the dev proxy avoids CORS.** In development the browser talks to the
Vite dev server (`http://127.0.0.1:5173`), and Vite's built-in proxy forwards
any request under `/api` or `/media` to the Django API (`VITE_API_PROXY`,
default `http://127.0.0.1:8000`) server-side, rewriting nothing but the
origin. From the browser's point of view every request is same-origin, so no
CORS preflight is ever needed in development. In production the app is
expected to be served from the same origin as the API (or `VITE_API_BASE_URL`
is set to an absolute API origin and the backend's `CORS_ORIGINS` env var
allowlists it — see `backend/README.md`).

## Running dev / test / build / lint

```bash
npm install          # or: npm ci (uses the lockfile exactly)
npm run dev           # Vite dev server on :5173, proxying /api and /media to :8000
npm run test           # vitest run (jsdom environment, Testing Library)
npm run test:watch     # vitest, watch mode
npm run coverage        # vitest run --coverage (@vitest/coverage-v8)
npm run build           # production build to dist/
npm run preview          # serve the dist/ build locally, on :4173
npm run lint              # eslint .
```

Tests live beside the code they cover in `__tests__/` directories
(`components/__tests__/SeverityBadge.test.jsx`,
`features/*/__tests__/*.test.js`, `lib/__tests__/api.test.js`,
`pages/__tests__/*.test.jsx`) plus one root-level `src/test/setup.js`
(Testing Library's `jest-dom` matchers). `vite.config.js`'s `test` block runs
Vitest in `jsdom` with `--no-experimental-webstorage` so Node's newer,
incomplete built-in `localStorage` implementation does not shadow jsdom's.

The production build is code-split at the route level (see "Screen inventory"
above) and `vite.config.js` additionally forces `recharts`/`d3-*` into their
own `charts` chunk, React/React-DOM/React-Router into `react-vendor`, Redux
Toolkit/`react-redux` into `state`, and `@radix-ui/*` into `radix` — so a
first paint of, say, `/login` does not have to download the charting library.
