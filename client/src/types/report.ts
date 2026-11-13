export type ReportStatus = 'draft' | 'open' | 'in_progress' | 'resolved';

export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SyncState = 'synced' | 'pending_sync' | 'local_draft';

export type ReportCategory =
  | 'electrical'
  | 'structural'
  | 'mechanical'
  | 'safety'
  | 'environmental';

export interface FieldReport {
  id: string;
  code: string;
  title: string;
  description: string;
  category: ReportCategory;
  severity: ReportSeverity;
  status: ReportStatus;
  syncState: SyncState;
  location: string;
  assetId: string;
  reporterName: string;
  reporterCrew: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  reportCode: string;
  actorName: string;
  action: string;
  targetLocation: string;
  timestamp: string;
  severity: ReportSeverity;
}
