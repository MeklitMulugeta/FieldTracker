import { Card } from '../common/Card';
import { cn } from '../../utils/cn';

export interface CoordinatorMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
}

export function CoordinatorKpiGrid({ metrics }: { metrics: CoordinatorMetrics }) {
  const cards = [
    {
      label: 'Total Reports',
      value: metrics.total,
      detail: 'Across all active sectors',
      valueClass: 'text-slate-900',
    },
    {
      label: 'Open Reports',
      value: metrics.open,
      detail: 'Awaiting crew dispatch',
      valueClass: 'text-blue-700',
    },
    {
      label: 'In Progress',
      value: metrics.inProgress,
      detail: 'Technicians on site',
      valueClass: 'text-amber-700',
    },
    {
      label: 'Resolved',
      value: metrics.resolved,
      detail: 'Verified & closed',
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Critical Issues',
      value: metrics.critical,
      detail: 'Immediate attention',
      valueClass: 'text-red-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label} padding="md">
          <p className="text-xs font-medium text-slate-500">{card.label}</p>
          <p
            className={cn(
              'mt-2 text-3xl font-bold font-display tabular-nums tracking-tight',
              card.valueClass,
            )}
          >
            {card.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
        </Card>
      ))}
    </div>
  );
}
