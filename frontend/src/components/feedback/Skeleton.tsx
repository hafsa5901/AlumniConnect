import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card p-6 border border-slate-200 space-y-4"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="pt-2 flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
};

export const TableRowSkeleton: React.FC<{ columns?: number; rows?: number }> = ({
  columns = 5,
  rows = 5,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100" aria-hidden="true">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-6 py-4">
              <Skeleton className="h-4 w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
