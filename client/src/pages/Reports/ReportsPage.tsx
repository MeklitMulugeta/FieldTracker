import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Search } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  LoadingIndicator,
  Select,
  SkeletonRows,
} from '../../components/common';
import {
  ReportSeverityBadge,
  ReportStatusBadge,
  SyncStateBadge,
} from '../../components/common/ReportBadges';
import { ReportDetailDrawer } from '../../components/common/ReportDetailDrawer';
import { CoordinatorLayout } from '../../components/layout/CoordinatorLayout';
import { WorkerLayout } from '../../components/layout/WorkerLayout';
import { SAMPLE_REPORTS, SAMPLE_WORKER_PROFILE } from '../../services/sampleData';
import type { FieldReport, ReportSeverity, ReportStatus } from '../../types/report';
import { cn } from '../../utils/cn';
import { formatCategoryLabel, formatRelativeTime } from '../../utils/formatters';

type StatusFilter = 'all' | ReportStatus;
type SeverityFilter = 'all' | ReportSeverity;

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'worker' ? 'worker' : 'coordinator';
  const severityParam = searchParams.get('severity') as SeverityFilter | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(
    severityParam && ['low', 'medium', 'high', 'critical'].includes(severityParam)
      ? severityParam
      : 'all',
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);

  useEffect(() => {
    if (severityParam && ['low', 'medium', 'high', 'critical'].includes(severityParam)) {
      setSeverityFilter(severityParam);
    } else if (!severityParam) {
      setSeverityFilter('all');
    }
  }, [severityParam]);

  const baseReports = useMemo(() => {
    if (activeView === 'worker') {
      return SAMPLE_REPORTS.filter(
        (report) => report.reporterName === SAMPLE_WORKER_PROFILE.fullName,
      );
    }
    return SAMPLE_REPORTS;
  }, [activeView]);

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return baseReports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) {
        return false;
      }
      if (severityFilter !== 'all' && report.severity !== severityFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        report.title.toLowerCase().includes(query) ||
        report.code.toLowerCase().includes(query) ||
        report.location.toLowerCase().includes(query) ||
        report.assetId.toLowerCase().includes(query)
      );
    });
  }, [baseReports, searchQuery, statusFilter, severityFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSeverityFilter('all');
    if (searchParams.has('severity')) {
      const next = new URLSearchParams(searchParams);
      next.delete('severity');
      setSearchParams(next);
    }
  };

  const triggerLoadingPreview = () => {
    setPreviewLoading(true);
    window.setTimeout(() => {
      setPreviewLoading(false);
    }, 650);
  };

  const pageBody = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {activeView === 'worker' ? 'Field Crew Records' : 'All Sectors'} · Sample Preview Data
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
            {activeView === 'worker' ? 'My Field Reports' : 'Field Reports Directory'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={triggerLoadingPreview}>
            Preview Loading State
          </Button>
          <Link
            to={`/reports/new?view=${activeView}`}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Create Report</span>
          </Link>
        </div>
      </div>

      {/* Filters bar */}
      <Card padding="md">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <Input
              label="Search reports"
              placeholder="Search by code (FT-1048), title, site, or asset ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <div className="w-full lg:w-52">
            <Select
              label="Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              options={[
                { value: 'all', label: 'All Severities' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'draft', label: 'Draft' },
                { id: 'open', label: 'Open' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'resolved', label: 'Resolved' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer',
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 tabular-nums">
            Showing {filteredReports.length} of {baseReports.length} sample reports
          </p>
        </div>
      </Card>

      {/* Reports list / table */}
      <Card padding="none">
        {previewLoading ? (
          <div className="p-5 space-y-2">
            <LoadingIndicator label="Refreshing sample field reports..." className="py-3" />
            <SkeletonRows rows={4} />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No matching field reports"
              description="Adjust your search query or reset active status and severity filters."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredReports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">{report.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatCategoryLabel(report.category)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{report.location}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatRelativeTime(report.updatedAt)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{report.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      Reporter: {report.reporterName} ({report.reporterCrew})
                      {report.assignedTo ? ` · Assigned to ${report.assignedTo}` : ' · Unassigned'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <ReportStatusBadge status={report.status} />
                    <ReportSeverityBadge severity={report.severity} />
                    <SyncStateBadge syncState={report.syncState} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReportDetailDrawer
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );

  const renderWithLayout = (content: ReactNode) =>
    activeView === 'worker' ? (
      <WorkerLayout>{content}</WorkerLayout>
    ) : (
      <CoordinatorLayout breadcrumb={severityFilter === 'critical' ? 'Critical Queue' : 'All Reports'}>
        {content}
      </CoordinatorLayout>
    );

  return renderWithLayout(pageBody);
}
