import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  FileEdit,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { ReportSeverity, ReportStatus, SyncState } from '../../types/report';
import {
  formatSeverityLabel,
  formatStatusLabel,
  formatSyncLabel,
} from '../../utils/formatters';
import { Badge, type BadgeTone } from './Badge';

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const config: Record<ReportStatus, { tone: BadgeTone; icon: typeof Clock }> = {
    draft: { tone: 'neutral', icon: FileEdit },
    open: { tone: 'info', icon: Info },
    in_progress: { tone: 'warning', icon: Clock },
    resolved: { tone: 'success', icon: CheckCircle2 },
  };
  const { tone, icon: Icon } = config[status];

  return (
    <Badge tone={tone} icon={<Icon className="h-3.5 w-3.5" />}>
      {formatStatusLabel(status)}
    </Badge>
  );
}

export function ReportSeverityBadge({ severity }: { severity: ReportSeverity }) {
  const config: Record<ReportSeverity, { tone: BadgeTone; icon: typeof AlertTriangle }> = {
    low: { tone: 'neutral', icon: Info },
    medium: { tone: 'info', icon: Clock },
    high: { tone: 'warning', icon: AlertTriangle },
    critical: { tone: 'danger', icon: AlertOctagon },
  };
  const { tone, icon: Icon } = config[severity];

  return (
    <Badge tone={tone} icon={<Icon className="h-3.5 w-3.5" />}>
      {formatSeverityLabel(severity)}
    </Badge>
  );
}

export function SyncStateBadge({ syncState }: { syncState: SyncState }) {
  const config: Record<SyncState, { tone: BadgeTone; icon: typeof RefreshCw }> = {
    synced: { tone: 'success', icon: CheckCircle2 },
    pending_sync: { tone: 'warning', icon: RefreshCw },
    local_draft: { tone: 'neutral', icon: CloudOff },
  };
  const { tone, icon: Icon } = config[syncState];

  return (
    <Badge tone={tone} icon={<Icon className="h-3.5 w-3.5" />}>
      {formatSyncLabel(syncState)}
    </Badge>
  );
}
