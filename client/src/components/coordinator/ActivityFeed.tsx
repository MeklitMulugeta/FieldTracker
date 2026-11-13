import type { ActivityEvent } from '../../types/report';
import { formatRelativeTime } from '../../utils/formatters';
import { Card, CardHeader } from '../common/Card';
import { ReportSeverityBadge } from '../common/ReportBadges';

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <Card padding="none">
      <div className="px-5 pt-5">
        <CardHeader
          title="Recent Activity"
          subtitle="Latest field updates across crews (sample)"
        />
      </div>

      <ul className="divide-y divide-slate-100">
        {events.map((event) => (
          <li key={event.id} className="px-5 py-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-medium text-slate-600">
                {event.reportCode}
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-snug">
              <span className="font-semibold text-slate-900">{event.actorName}</span>{' '}
              {event.action}
            </p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-xs text-slate-500 truncate">{event.targetLocation}</span>
              <ReportSeverityBadge severity={event.severity} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
