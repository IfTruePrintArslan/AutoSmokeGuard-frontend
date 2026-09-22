import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Pagination from '../components/ui/Pagination'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SeverityBadge from '../components/ui/SeverityBadge'
import {
  fetchHistory,
  setFilter,
  setFilters,
  setPage,
  setPageSize,
  resetFilters,
} from '../features/history/historySlice'
import { deleteAnalysis } from '../features/analysis/analysisSlice'
import { pushToast } from '../features/ui/uiSlice'
import { apiDownload, mediaUrl } from '../lib/api'

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
]
const VEHICLE_OPTIONS = [
  { value: 'all', label: 'All vehicles' },
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bus', label: 'Bus' },
  { value: 'truck', label: 'Truck' },
]
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
]
const ORDERING_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: '-total_vehicles', label: 'Most vehicles' },
  { value: 'total_vehicles', label: 'Fewest vehicles' },
  { value: '-avg_confidence', label: 'Highest confidence' },
  { value: 'avg_confidence', label: 'Lowest confidence' },
]

const FILTER_KEYS = ['severity', 'vehicle_type', 'status', 'date_from', 'date_to', 'search', 'ordering']

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export default function HistoryPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { items, count, page, pages, pageSize, filters, status, error } = useSelector((s) => s.history)

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const didHydrateRef = useRef(false)

  // One-time: hydrate filters/page/pageSize from the URL so it's shareable.
  // Uses a ref guard (not local state) so this never fires more than once,
  // even under StrictMode's double-invoke.
  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    const next = {}
    FILTER_KEYS.forEach((key) => {
      const v = searchParams.get(key)
      if (v) next[key] = v
    })
    if (Object.keys(next).length) dispatch(setFilters(next))
    const p = Number(searchParams.get('page'))
    if (p) dispatch(setPage(p))
    const ps = Number(searchParams.get('page_size'))
    if (ps) dispatch(setPageSize(ps))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch + keep the URL in sync whenever filters/page/pageSize change.
  useEffect(() => {
    const params = { page, page_size: pageSize, ...filters }
    dispatch(fetchHistory(params))
    const next = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) next.set(k, String(v)) })
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters])

  // Debounced (300ms) search box -> filters.search
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== filters.search) dispatch(setFilter({ key: 'search', value: searchInput }))
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const handleSelectFilter = (key) => (value) => {
    dispatch(setFilter({ key, value: value === 'all' ? '' : value }))
  }

  const handleResetFilters = () => {
    dispatch(resetFilters())
    setSearchInput('')
  }

  const hasActiveFilters = FILTER_KEYS.some((k) => k !== 'ordering' && filters[k])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await dispatch(deleteAnalysis(deleteTarget.analysis_id))
    setDeleting(false)
    setDeleteTarget(null)
    if (deleteAnalysis.fulfilled.match(result)) {
      dispatch(pushToast({ message: 'Analysis deleted.', variant: 'success' }))
      dispatch(fetchHistory({ page, page_size: pageSize, ...filters }))
    } else {
      dispatch(pushToast({ message: result.payload?.detail || 'Failed to delete analysis.', variant: 'error' }))
    }
  }

  const handleDownload = async (row) => {
    if (!row.report?.report_id) return
    try {
      await apiDownload(`/api/download-report/${row.report.report_id}`, `${row.media?.filename || 'report'}.pdf`)
    } catch {
      dispatch(pushToast({ message: 'Failed to download report.', variant: 'error' }))
    }
  }

  return (
    <div className="flex flex-col">
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Browse past analyses and detection records.</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-[14px] mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[150px]">
          <label className="block text-[11px] font-semibold text-muted mb-1.5" htmlFor="history-search">Search</label>
          <input
            id="history-search"
            type="search"
            placeholder="Filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text outline-none focus-visible:border-text-3"
          />
        </div>

        <div className="min-w-[150px]">
          <label className="block text-[11px] font-semibold text-muted mb-1.5">Severity</label>
          <Select value={filters.severity || 'all'} onValueChange={handleSelectFilter('severity')}>
            <SelectTrigger aria-label="Filter by severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-[11px] font-semibold text-muted mb-1.5">Vehicle type</label>
          <Select value={filters.vehicle_type || 'all'} onValueChange={handleSelectFilter('vehicle_type')}>
            <SelectTrigger aria-label="Filter by vehicle type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VEHICLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-[11px] font-semibold text-muted mb-1.5">Status</label>
          <Select value={filters.status || 'all'} onValueChange={handleSelectFilter('status')}>
            <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-[11px] font-semibold text-muted mb-1.5">Order by</label>
          <Select value={filters.ordering} onValueChange={handleSelectFilter('ordering')}>
            <SelectTrigger aria-label="Order results"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDERING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-muted mb-1.5" htmlFor="history-date-from">From</label>
          <input
            id="history-date-from"
            type="date"
            value={filters.date_from}
            onChange={(e) => dispatch(setFilter({ key: 'date_from', value: e.target.value }))}
            className="h-9 rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text outline-none focus-visible:border-text-3"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted mb-1.5" htmlFor="history-date-to">To</label>
          <input
            id="history-date-to"
            type="date"
            value={filters.date_to}
            onChange={(e) => dispatch(setFilter({ key: 'date_to', value: e.target.value }))}
            className="h-9 rounded-[9px] border border-line-2 bg-bg-2 px-3 text-[13px] text-text outline-none focus-visible:border-text-3"
          />
        </div>

        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost h-9" onClick={handleResetFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {status === 'pending' && !items.length ? (
        <div className="card overflow-hidden">
          <div className="p-[18px] flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        </div>
      ) : status === 'rejected' && !items.length ? (
        <ErrorState message={error} onRetry={() => dispatch(fetchHistory({ page, page_size: pageSize, ...filters }))} />
      ) : count === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No analyses match your filters"
            description="Try adjusting or clearing the filters above."
            action={<button type="button" className="btn btn-ghost" onClick={handleResetFilters}>Clear filters</button>}
          />
        ) : (
          <EmptyState
            title="No analyses yet — upload media to get started"
            description="Upload traffic footage or stills to run your first smoke detection analysis."
            action={<button type="button" className="btn btn-pri" onClick={() => navigate('/upload')}>Upload media</button>}
          />
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <tbody>
                <tr>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Vehicles</th>
                  <th>Smoke</th>
                  <th>Confidence</th>
                  <th>Severity</th>
                  <th></th>
                </tr>
                {items.map((row) => (
                  <tr key={row.analysis_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {row.preview_url ? (
                          <img src={mediaUrl(row.preview_url)} alt="" className="thumb object-cover" />
                        ) : (
                          <div className="thumb" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-[550] truncate max-w-[220px]">{row.media?.filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-text-2">{fmtDate(row.created_at)}</td>
                    <td className="mono">{row.total_vehicles ?? '—'}</td>
                    <td className="mono">{row.total_smoke ?? '—'}</td>
                    <td className="mono">{row.avg_confidence != null ? row.avg_confidence.toFixed(2) : '—'}</td>
                    <td>{row.overall_severity ? <SeverityBadge severity={row.overall_severity} /> : '—'}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Link className="link" to={`/analysis/${row.analysis_id}`}>View</Link>
                        {row.report && (
                          <button type="button" className="link" onClick={() => handleDownload(row)}>PDF</button>
                        )}
                        <button
                          type="button"
                          className="link text-high"
                          style={{ color: 'var(--color-high)' }}
                          onClick={() => setDeleteTarget(row)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pages={pages}
            pageSize={pageSize}
            onPageChange={(p) => dispatch(setPage(p))}
            onPageSizeChange={(ps) => dispatch(setPageSize(ps))}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this analysis?"
        description={`This permanently deletes "${deleteTarget?.media?.filename}" and any generated report. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
