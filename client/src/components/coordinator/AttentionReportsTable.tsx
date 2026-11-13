import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FieldReport } from '../../types/report';
import { cn } from '../../utils/cn';
import { formatRelativeTime } from '../../utils/formatters';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { ReportSeverityBadge, ReportStatusBadge } from '../common/ReportBadges';

interface AttentionReportsTableProps {
  reports: FieldReport[];
  onSelectReport: (report: FieldReport) => void;
}

type AttentionFilter = 'all' | 'critical' | 'unassigned';

export function AttentionReportsTable({
  reports,
  onSelectReport,
}: AttentionReportsTableProps) {
  const [filter, setFilter] = useState<AttentionFilter>('all');

  const filteredReports = reports.filter((report) => {
    if (filter === 'critical') {
      return report.severity === 'critical';
    }
    if (filter === 'unassigned') {
      return report.assignedTo === null;
    }
    return true;
  });

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Reports Requiring Attention
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Open and in-progress field issues prioritized by severity
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Priority' },
              { id: 'critical', label: 'Critical' },
              { id: 'unassigned', label: 'Unassigned' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer',
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No reports match this queue filter"
            description="Switch to All Priority or browse the complete reports directory."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">Report</th>
                <th className="py-3 px-3 whitespace-nowrap">Location</th>
                <th className="py-3 px-3 whitespace-nowrap">Severity</th>
                <th className="py-3 px-3 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 whitespace-nowrap">Assignee</th>
                <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredReports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 pl-5 pr-3 max-w-xs">
                    <p className="font-mono text-xs text-slate-500">{report.code}</p>
                    <p className="font-medium text-slate-900 truncate">{report.title}</p>
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                    {report.location}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <ReportSeverityBadge severity={report.severity} />
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <ReportStatusBadge status={report.status} />
                  </td>
                  <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                    {report.assignedTo ?? (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {formatRelativeTime(report.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/40 flex items-center justify-between text-xs text-slate-500">
        <span>Showing {filteredReports.length} sample priority records</span>
        <Link
          to="/reports?view=coordinator"
          className="font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
        >
          Open full directory
        </Link>
      </div>
    </Card>
  );
}
