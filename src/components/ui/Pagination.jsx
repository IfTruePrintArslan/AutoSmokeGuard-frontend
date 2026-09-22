export default function Pagination({
  page,
  pages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className = '',
}) {
  const totalPages = Math.max(pages || 1, 1)
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap px-[18px] py-3 border-t border-line ${className}`}>
      <div className="flex items-center gap-2 text-[12px] text-text-2">
        <label htmlFor="pagination-page-size">Rows per page</label>
        <select
          id="pagination-page-size"
          className="bg-bg-2 border border-line-2 rounded-[7px] text-[12px] text-text py-1 px-2 outline-none"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost h-8 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <span className="text-[12px] text-text-2 mono">Page {page} of {totalPages}</span>
        <button
          type="button"
          className="btn btn-ghost h-8 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
