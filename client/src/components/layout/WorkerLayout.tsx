import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ClipboardList,
  Compass,
  Home,
  LogOut,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface WorkerLayoutProps {
  children: ReactNode;
}

export function WorkerLayout({ children }: WorkerLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Mobile-first compact navy header; expands cleanly on desktop */}
      <header className="sticky top-0 z-30 h-14 bg-[#0B192C] text-white border-b border-slate-800">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <Link
            to="/worker"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight whitespace-nowrap shrink-0"
          >
            <Compass className="h-5 w-5 text-blue-400 shrink-0" aria-hidden="true" />
            <span>FieldTrack</span>
          </Link>

          <nav
            aria-label="Worker navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <NavLink
              to="/worker"
              end
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors hover:text-white',
                  isActive && 'text-white underline underline-offset-8 decoration-blue-400 decoration-2',
                )
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/reports?view=worker"
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors hover:text-white',
                  isActive && 'text-white underline underline-offset-8 decoration-blue-400 decoration-2',
                )
              }
            >
              My Reports
            </NavLink>
            <NavLink
              to="/reports/new?view=worker"
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors hover:text-white',
                  isActive && 'text-white underline underline-offset-8 decoration-blue-400 decoration-2',
                )
              }
            >
              New Report
            </NavLink>
            <NavLink
              to="/coordinator"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-white"
            >
              Coordinator View
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/reports/new?view=worker"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create Report</span>
            </Link>
            <Link
              to="/login"
              aria-label="Sign out to login preview"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors md:px-2.5 md:gap-1.5 text-xs font-medium"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline whitespace-nowrap">Sign Out</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-5 sm:py-8 pb-24 md:pb-10">
        {children}
      </main>

      {/* Thumb-zone mobile bottom navigation bar */}
      <nav
        aria-label="Mobile worker tabs"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center px-1"
      >
        <NavLink
          to="/worker"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center min-h-[44px] rounded-lg transition-colors',
              isActive ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          <span className="mt-0.5 text-[11px] font-medium">Home</span>
        </NavLink>

        <NavLink
          to="/reports?view=worker"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center min-h-[44px] rounded-lg transition-colors',
              isActive ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          <span className="mt-0.5 text-[11px] font-medium">Reports</span>
        </NavLink>

        <NavLink
          to="/reports/new?view=worker"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center min-h-[44px] rounded-lg transition-colors',
              isActive ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900',
            )
          }
        >
          <PlusCircle className="h-5 w-5" aria-hidden="true" />
          <span className="mt-0.5 text-[11px] font-medium">Create</span>
        </NavLink>

        <NavLink
          to="/coordinator"
          className="flex flex-col items-center justify-center min-h-[44px] rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <span className="mt-0.5 text-[11px] font-medium">Dispatch</span>
        </NavLink>
      </nav>
    </div>
  );
}
