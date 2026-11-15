import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({ page, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#ECE8F4]">
      <p className="text-xs font-mono tabular-nums text-[#77718C]">
        Page {page} of {totalPages}
        {typeof totalItems === 'number' ? ` · ${totalItems.toLocaleString()} results` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`h-8 min-w-8 px-2.5 rounded-lg text-xs font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
              p === page
                ? 'bg-[#7257E8] text-white'
                : 'bg-white border border-[#ECE8F4] text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35]'
            }`}
          >
            {p}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
