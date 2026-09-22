import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiDownload, ApiError } from '../lib/api'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Pagination from '../components/ui/Pagination'
import SeverityBadge from '../components/ui/SeverityBadge'
import { pushToast } from '../features/ui/uiSlice'

function fmtBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function shortId(id) {
  return id ? id.slice(0, 8) : '—'
}

export default function ReportsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [params, setParams] = useState({ page: 1, pageSize: 10 })
  const [reloadToken, setReloadToken] = useState(0)
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [pages, setPages] = useState(1)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const { page, pageSize } = params

  // Fetches whenever page/pageSize change, or `reloadToken` is bumped (retry).
  useEffect(() => {
    let ignore = false
    async function run() {
      setStatus('pending')
      setError(null)
      try {
        const data = await apiGet(`/api/reports?page=${params.page}&page_size=${params.pageSize}`)
        if (ignore) return
        setItems(data.results || [])
        setCount(data.count ?? 0)
        setPages(data.pages ?? 1)
        setStatus('fulfilled')
      } catch (err) {
        if (ignore) return
        setError(err instanceof ApiError ? err.detail : 'Failed to load reports.')
        setStatus('rejected')
      }
    }
    run()
    return () => { ignore = true }
  }, [params, reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  const handleDownload = async (report) => {
    try {
      await apiDownload(`/api/download-report/${report.report_id}`, `report-${shortId(report.report_id)}.pdf`)
    } catch {
      dispatch(pushToast({ message: 'Failed to download report.', variant: 'error' }))
    }
  }

  return (
    <div className="flex flex-col">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>View and export vehicle emission reports.</p>
        </div>
      </div>

      {status === 'pending' && !items.length ? (
        <div className="card overflow-hidden">
          <div className="p-[18px] flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        </div>
      ) : status === 'rejected' && !items.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : count === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Reports are generated from completed analyses. Run an analysis and generate a PDF to see it here."
          action={<button type="button" className="btn btn-pri" onClick={() => navigate('/upload')}>Upload media</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <tbody>
                <tr>
                  <th>Report</th>
                  <th>Source</th>
                  <th>Generated</th>
                  <th>Pages</th>
                  <th>Size</th>
                  <th>Severity</th>
                  <th></th>
                </tr>
                {items.map((report) => (
                  <tr key={report.report_id}>
                    <td className="mono">#{shortId(report.report_id)}</td>
                    <td className="truncate max-w-[220px]">
                      {report.analysis?.media?.filename || '—'}
                    </td>
                    <td className="text-text-2">{fmtDate(report.generated_at)}</td>
                    <td className="mono">{report.page_count ?? '—'}</td>
                    <td className="mono">{fmtBytes(report.file_size_bytes)}</td>
                    <td>
                      <SeverityBadge severity={report.analysis?.overall_severity} />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button type="button" className="link" onClick={() => handleDownload(report)}>Download</button>
                        {report.analysis_id && (
                          <Link className="link" to={`/analysis/${report.analysis_id}`}>View analysis</Link>
                        )}
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
            onPageChange={(p) => setParams((prev) => ({ ...prev, page: p }))}
            onPageSizeChange={(ps) => setParams({ page: 1, pageSize: ps })}
          />
        </div>
      )}
    </div>
  )
}
