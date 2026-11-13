import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, Card, Input, Select } from '../../components/common';

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [crew, setCrew] = useState('');
  const [role, setRole] = useState<'worker' | 'coordinator'>('worker');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    navigate(role === 'coordinator' ? '/coordinator' : '/worker');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-start">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-base font-semibold text-[#0B192C]"
          >
            <Compass className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span>FieldTrack</span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold font-display text-slate-900 tracking-tight">
            Create a FieldTrack account
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            UI preview only. Real registration and role permissions will be enabled in subsequent
            milestones.
          </p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Marcus Rivera"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Work Email"
              type="email"
              placeholder="m.rivera@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Select
              label="Operational Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'worker' | 'coordinator')}
              options={[
                { value: 'worker', label: 'Field Worker' },
                { value: 'coordinator', label: 'Operations Coordinator' },
              ]}
            />

            <Input
              label="Crew or Sector"
              placeholder="Crew 4B · Northern Grid"
              value={crew}
              onChange={(e) => setCrew(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button type="submit" fullWidth size="lg">
                Continue to {role === 'coordinator' ? 'Coordinator' : 'Worker'} Preview
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
