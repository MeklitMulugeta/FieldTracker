import { CloudOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';

interface NetworkSyncBannerProps {
  pendingCount: number;
}

export function NetworkSyncBanner({ pendingCount }: NetworkSyncBannerProps) {
  const isOnline = useOnlineStatus();

  return (
    <Card padding="sm" className="bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-700" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {isOnline ? 'Network Connected' : 'Offline Mode Active'}
              </p>
              <Badge
                tone={isOnline ? 'success' : 'warning'}
                icon={
                  isOnline ? (
                    <RefreshCw className="h-3 w-3" />
                  ) : (
                    <CloudOff className="h-3 w-3" />
                  )
                }
              >
                {isOnline ? 'Ready' : 'Local Only'}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {pendingCount}
              </span>{' '}
              sample reports pending sync · Offline queue integration scheduled for next milestone
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
