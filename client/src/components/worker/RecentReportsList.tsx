import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FieldReport } from '../../types/report';
import { formatRelativeTime } from '../../utils/formatters';
import { Card, CardHeader } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { ReportSeverityBadge, ReportStatusBadge, SyncStateBadge } from '../common/ReportBadges';

interface RecentReportsListProps {
  reports: FieldReport[];
  onSelectReport: (report: FieldReport) => void;
}

export function RecentReportsList({ reports, onSelectReport }: RecentReportsListProps) {
  return (
    <Card padding="none">
      <div className="px-5 pt-5">
        <CardHeader
          title="Recent Field Reports"
          subtitle="Tap any entry to inspect sample issue details"
          action={
            <Link
              to="/reports?view=worker"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              View all
            </Link>
          }
        />
      </div>

      {reports.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No reports logged yet"
            description="Field issue reports you draft or submit will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {reports.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => onSelectReport(report)}
                className="w-full min-h-[68px] px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 active:bg-slate-100/70 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-mono font-medium text-slate-700">{report.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{report.location}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatRelativeTime(report.updatedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {report.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ReportStatusBadge status={report.status} />
                    <ReportSeverityBadge severity={report.severity} />
                    <SyncStateBadge syncState={report.syncState} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
