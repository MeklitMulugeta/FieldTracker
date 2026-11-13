import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500">
        {icon ?? <ClipboardList className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
