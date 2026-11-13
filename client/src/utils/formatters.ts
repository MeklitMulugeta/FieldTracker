import type { ReportCategory, ReportSeverity, ReportStatus, SyncState } from '../types/report';

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function formatStatusLabel(status: ReportStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In Progress';
    case 'resolved':
      return 'Resolved';
  }
}

export function formatSeverityLabel(severity: ReportSeverity): string {
  switch (severity) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'critical':
      return 'Critical';
  }
}

export function formatSyncLabel(syncState: SyncState): string {
  switch (syncState) {
    case 'synced':
      return 'Synced';
    case 'pending_sync':
      return 'Pending Sync';
    case 'local_draft':
      return 'Local Draft';
  }
}

export function formatCategoryLabel(category: ReportCategory): string {
  switch (category) {
    case 'electrical':
      return 'Electrical';
    case 'structural':
      return 'Structural';
    case 'mechanical':
      return 'Mechanical';
    case 'safety':
      return 'Safety Hazard';
    case 'environmental':
      return 'Environmental';
  }
}
