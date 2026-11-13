import { useMemo, useState } from 'react';
import { ReportDetailDrawer } from '../../components/common/ReportDetailDrawer';
import { ActivityFeed } from '../../components/coordinator/ActivityFeed';
import { AttentionReportsTable } from '../../components/coordinator/AttentionReportsTable';
import { CoordinatorKpiGrid } from '../../components/coordinator/CoordinatorKpiGrid';
import { CoordinatorLayout } from '../../components/layout/CoordinatorLayout';
import { SAMPLE_ACTIVITY_FEED, SAMPLE_REPORTS } from '../../services/sampleData';
import type { FieldReport } from '../../types/report';

export function CoordinatorDashboardPage() {
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);

  const metrics = useMemo(() => {
    return {
      total: SAMPLE_REPORTS.length,
      open: SAMPLE_REPORTS.filter((r) => r.status === 'open').length,
      inProgress: SAMPLE_REPORTS.filter((r) => r.status === 'in_progress').length,
      resolved: SAMPLE_REPORTS.filter((r) => r.status === 'resolved').length,
      critical: SAMPLE_REPORTS.filter((r) => r.severity === 'critical').length,
    };
  }, []);

  const attentionReports = useMemo(
    () =>
      SAMPLE_REPORTS.filter(
        (report) => report.status === 'open' || report.status === 'in_progress',
      ),
    [],
  );

  return (
    <CoordinatorLayout breadcrumb="Operations Overview">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Regional Dispatch · Sample Preview Data
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
              Field Operations Overview
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Click any issue row to inspect sample field details
          </p>
        </div>

        <CoordinatorKpiGrid metrics={metrics} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8">
            <AttentionReportsTable
              reports={attentionReports}
              onSelectReport={setSelectedReport}
            />
          </div>
          <div className="xl:col-span-4">
            <ActivityFeed events={SAMPLE_ACTIVITY_FEED} />
          </div>
        </div>
      </div>

      <ReportDetailDrawer
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </CoordinatorLayout>
  );
}
