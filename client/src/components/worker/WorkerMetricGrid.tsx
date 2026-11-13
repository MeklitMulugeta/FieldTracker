import { Card } from '../common/Card';

export interface WorkerMetrics {
  total: number;
  drafts: number;
  submitted: number;
  pendingSync: number;
}

export function WorkerMetricGrid({ metrics }: { metrics: WorkerMetrics }) {
  const items = [
    {
      label: 'Total Reports',
      value: metrics.total,
      note: 'Assigned & authored',
    },
    {
      label: 'Draft Reports',
      value: metrics.drafts,
      note: 'Saved locally (sample)',
    },
    {
      label: 'Submitted Reports',
      value: metrics.submitted,
      note: 'Open, active, or resolved',
    },
    {
      label: 'Pending Sync',
      value: metrics.pendingSync,
      note: 'Awaiting upload queue',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item) => (
        <Card key={item.label} padding="sm" className="sm:p-5">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold font-display text-slate-900 tabular-nums">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">{item.note}</p>
        </Card>
      ))}
    </div>
  );
}
