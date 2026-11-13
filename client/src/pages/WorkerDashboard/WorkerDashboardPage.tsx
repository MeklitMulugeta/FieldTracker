import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { ReportDetailDrawer } from '../../components/common/ReportDetailDrawer';
import { WorkerLayout } from '../../components/layout/WorkerLayout';
import { NetworkSyncBanner } from '../../components/worker/NetworkSyncBanner';
import { RecentReportsList } from '../../components/worker/RecentReportsList';
import { WorkerMetricGrid } from '../../components/worker/WorkerMetricGrid';
import { SAMPLE_REPORTS, SAMPLE_WORKER_PROFILE } from '../../services/sampleData';
import type { FieldReport } from '../../types/report';

export function WorkerDashboardPage() {
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);

  const workerReports = useMemo(
    () => SAMPLE_REPORTS.filter((report) => report.reporterName === SAMPLE_WORKER_PROFILE.fullName),
    [],
  );

  const metrics = useMemo(() => {
    const drafts = workerReports.filter((r) => r.status === 'draft').length;
    const submitted = workerReports.filter((r) => r.status !== 'draft').length;
    const pendingSync = workerReports.filter((r) => r.syncState === 'pending_sync').length;

    return {
      total: workerReports.length,
      drafts,
      submitted,
      pendingSync,
    };
  }, [workerReports]);

  return (
    <WorkerLayout>
      <div className="space-y-6">
        {/* Welcome & primary action header */}
        <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {SAMPLE_WORKER_PROFILE.crewOrRegion} · Sample Preview Data
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight text-balance">
              Welcome back, {SAMPLE_WORKER_PROFILE.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Capture equipment faults on site and review local report status.
            </p>
          </div>

          <Link
            to="/reports/new?view=worker"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Create Report</span>
          </Link>
        </section>

        {/* Network and synchronization indicator */}
        <NetworkSyncBanner pendingCount={metrics.pendingSync} />

        {/* Summary metric cards */}
        <WorkerMetricGrid metrics={metrics} />

        {/* Recent reports */}
        <RecentReportsList
          reports={workerReports.slice(0, 5)}
          onSelectReport={setSelectedReport}
        />
      </div>

      <ReportDetailDrawer
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </WorkerLayout>
  );
}
