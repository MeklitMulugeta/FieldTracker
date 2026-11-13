import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface LoadingIndicatorProps {
  label?: string;
  className?: string;
}

export function LoadingIndicator({ label = 'Loading records...', className }: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2.5 py-8 text-sm text-slate-600', className)}
    >
      <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-3.5 px-1">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="h-6 w-20 rounded bg-slate-100 animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}
