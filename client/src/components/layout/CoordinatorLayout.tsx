import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowLeftRight,
  ClipboardList,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  X,
} from 'lucide-react';
import { SAMPLE_COORDINATOR_PROFILE } from '../../services/sampleData';
import { cn } from '../../utils/cn';

interface CoordinatorLayoutProps {
  breadcrumb: string;
  children: ReactNode;
}

const navItems = [
  { label: 'Overview', to: '/coordinator', icon: LayoutDashboard, end: true },
  { label: 'All Reports', to: '/reports?view=coordinator', icon: ClipboardList, end: true },
  {
    label: 'Critical Queue',
    to: '/reports?view=coordinator&severity=critical',
    icon: AlertOctagon,
    end: true,
  },
  { label: 'Create Report', to: '/reports/new?view=coordinator', icon: PlusCircle, end: true },
];

export function CoordinatorLayout({ breadcrumb, children }: CoordinatorLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B192C] text-slate-200">
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80">
        <Link
          to="/coordinator"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-2.5 text-base font-semibold text-white tracking-tight whitespace-nowrap"
        >
          <Compass className="h-5 w-5 text-blue-400 shrink-0" aria-hidden="true" />
          <span>FieldTrack</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pt-5 pb-2">
        <p className="px-2 text-xs font-medium text-slate-400">Operations Dispatch</p>
      </div>

      <nav aria-label="Coordinator navigation" className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 p-3 space-y-1">
        <Link
          to="/worker"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
          <span>Switch to Worker View</span>
        </Link>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {SAMPLE_COORDINATOR_PROFILE.fullName}
            </p>
            <p className="truncate text-xs text-slate-400">
              {SAMPLE_COORDINATOR_PROFILE.crewOrRegion}
            </p>
          </div>
          <Link
            to="/login"
            aria-label="Sign out to login preview"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop fixed navy sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile slide-over drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 max-w-[80vw] h-full shadow-xl">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 bg-slate-950/40"
          />
        </div>
      ) : null}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="hidden sm:inline whitespace-nowrap">Coordinator</span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">{breadcrumb}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/reports/new?view=coordinator"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Create Report</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
