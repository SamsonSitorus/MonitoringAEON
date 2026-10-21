import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.85rem 1.25rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        marginTop: '1.25rem',
      }}
    >
      {/* Left: Summary and Page Size Select */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
          Menampilkan <strong style={{ color: '#ffffff' }}>{startItem} - {endItem}</strong> dari{' '}
          <strong style={{ color: '#ffffff' }}>{totalItems}</strong> data
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Tampilkan:</span>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                width: 'auto',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                colorScheme: 'dark',
                outline: 'none',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option
                  key={opt}
                  value={opt}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '8px 12px',
                    fontWeight: 500,
                  }}
                >
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Pagination Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: currentPage === 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-muted)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Halaman Pertama"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: currentPage === 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-muted)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Halaman Sebelumnya"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Numbers */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-dim)',
                  userSelect: 'none',
                }}
              >
                ...
              </span>
            );
          }

          const pageNum = Number(p);
          const isActive = currentPage === pageNum;

          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                minWidth: '32px',
                height: '30px',
                padding: '0 6px',
                background: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                borderRadius: '6px',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive ? '0 0 10px rgba(2, 132, 199, 0.35)' : undefined,
                transition: 'all 0.15s ease',
              }}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-muted)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Halaman Berikutnya"
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: currentPage === totalPages ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-muted)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Halaman Terakhir"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};
