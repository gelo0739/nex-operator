import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Table footer: a summary on the left, page buttons on the right. Cursor
 * pagination can only jump to pages whose start is known (`knownPages`, from
 * useCursorPagination); later pages show as "… N" and are reached with Next.
 */
export default function Pagination({ page, totalPages, knownPages, onPageChange, summary, className = '' }) {
  const reachablePages = Math.min(totalPages, knownPages);
  const canNext = page < reachablePages;
  const arrowClass = 'p-1.5 text-slate-700 hover:bg-white rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-[#eef1fb]/70 ${className}`}>
      {summary}
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className={arrowClass}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: reachablePages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`text-xs font-semibold min-w-8 h-8 px-2 rounded-lg cursor-pointer ${
              n === page ? 'bg-blue-600 text-white shadow shadow-blue-500/30' : 'text-slate-700 hover:bg-white'
            }`}
          >
            {n}
          </button>
        ))}
        {totalPages > reachablePages && (
          <>
            <span className="w-6 text-center text-xs text-slate-500">…</span>
            <span className="text-xs font-semibold text-slate-400 px-2" title="Use Next to go further">
              {totalPages}
            </span>
          </>
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={!canNext} aria-label="Next page" className={arrowClass}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
