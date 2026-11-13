import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, HardHat, ShieldCheck } from 'lucide-react';
import { Button, Card, Input, Select } from '../../components/common';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolePreview, setRolePreview] = useState<'worker' | 'coordinator'>('worker');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    navigate(rolePreview === 'coordinator' ? '/coordinator' : '/worker');
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12">
      {/* Left navy operational brand column on desktop */}
      <aside className="lg:col-span-5 bg-[#0B192C] text-white px-6 py-10 sm:px-10 lg:px-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <Compass className="h-6 w-6 text-blue-400 shrink-0" aria-hidden="true" />
            <span>FieldTrack</span>
          </div>

          <h1 className="mt-10 text-3xl sm:text-4xl font-bold font-display tracking-tight text-balance leading-tight">
            Field issue tracking built for low-connectivity sites.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
            Log equipment faults in the field, track local drafts when signal drops, and coordinate
            crew dispatch from one operational workspace.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-800 space-y-4">
          <p className="text-xs font-medium text-slate-400">Workspace Previews</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => navigate('/worker')}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-left hover:border-blue-500/70 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <HardHat className="h-5 w-5 text-blue-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Worker Dashboard</p>
                  <p className="text-xs text-slate-400 truncate">Mobile-first field logging view</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/coordinator')}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-left hover:border-blue-500/70 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Coordinator Dashboard</p>
                  <p className="text-xs text-slate-400 truncate">Desktop triage and dispatch view</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right clean white sign-in surface */}
      <main className="lg:col-span-7 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
              Sign in to FieldTrack
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Preview workspace navigation. Authentication will be connected in an upcoming
              milestone.
            </p>
          </div>

          <Card padding="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Work Email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <Select
                label="Preview Role Destination"
                value={rolePreview}
                onChange={(e) =>
                  setRolePreview(e.target.value as 'worker' | 'coordinator')
                }
                options={[
                  { value: 'worker', label: 'Field Worker (Mobile-First)' },
                  { value: 'coordinator', label: 'Operations Coordinator (Desktop-First)' },
                ]}
                hint="Authentication is not active yet; select which workspace preview to open."
              />

              <div className="pt-2">
                <Button type="submit" fullWidth size="lg">
                  Continue to Preview Workspace
                </Button>
              </div>
            </form>
          </Card>

          <p className="text-center text-sm text-slate-600">
            Need a field crew account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
