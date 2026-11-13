import { MapPin, User, Wrench, X } from 'lucide-react';
import type { FieldReport } from '../../types/report';
import { formatCategoryLabel, formatShortDate } from '../../utils/formatters';
import { Button } from './Button';
import { ReportSeverityBadge, ReportStatusBadge, SyncStateBadge } from './ReportBadges';

interface ReportDetailDrawerProps {
  report: FieldReport | null;
  onClose: () => void;
}

export function ReportDetailDrawer({ report, onClose }: ReportDetailDrawerProps) {
  if (!report) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-drawer-title"
    >
      <button
        type="button"
        aria-label="Close details overlay"
        onClick={onClose}
        className="flex-1 cursor-default"
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white border-l border-slate-200 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>{report.code}</span>
              <span aria-hidden="true">·</span>
              <span>{report.assetId}</span>
            </div>
            <h2
              id="report-drawer-title"
              className="mt-1 text-lg font-semibold text-slate-900 leading-snug"
            >
              {report.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report details"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.status} />
            <ReportSeverityBadge severity={report.severity} />
            <SyncStateBadge syncState={report.syncState} />
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Issue Summary
            </h3>
            <p className="text-sm leading-relaxed text-slate-700">{report.description}</p>
          </section>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Location
              </dt>
              <dd className="mt-1 font-medium text-slate-900">{report.location}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                Category
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatCategoryLabel(report.category)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                Reported By
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {report.reporterName} · {report.reporterCrew}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Assigned Coordinator / Tech</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {report.assignedTo ?? 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Created</dt>
              <dd className="mt-1 font-mono text-xs text-slate-700 tabular-nums">
                {formatShortDate(report.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last Updated</dt>
              <dd className="mt-1 font-mono text-xs text-slate-700 tabular-nums">
                {formatShortDate(report.updatedAt)}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
            Sample Preview Record: Live status updates, coordinator assignment, and photo
            attachments will be connected in upcoming milestones.
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/70">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
}
