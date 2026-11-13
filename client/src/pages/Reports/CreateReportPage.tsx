import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2 } from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '../../components/common';
import { CoordinatorLayout } from '../../components/layout/CoordinatorLayout';
import { WorkerLayout } from '../../components/layout/WorkerLayout';

interface FormValues {
  title: string;
  category: string;
  severity: string;
  location: string;
  assetId: string;
  description: string;
}

export function CreateReportPage() {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'worker' ? 'worker' : 'coordinator';

  const [values, setValues] = useState<FormValues>({
    title: '',
    category: 'electrical',
    severity: 'medium',
    location: '',
    assetId: '',
    description: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormValues, string>> = {};
    if (!values.title.trim()) {
      nextErrors.title = 'Enter a concise issue title.';
    }
    if (!values.location.trim()) {
      nextErrors.location = 'Specify the site or substation location.';
    }
    if (!values.description.trim() || values.description.trim().length < 10) {
      nextErrors.description = 'Provide at least 10 characters describing the observation.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      setPreviewSubmitted(false);
      return;
    }
    setPreviewSubmitted(true);
  };

  const content = (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          to={activeView === 'worker' ? '/worker' : '/coordinator'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to {activeView === 'worker' ? 'Worker Dashboard' : 'Overview'}</span>
        </Link>

        <h1 className="mt-3 text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
          Create Field Issue Report
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Form preview using the FieldTrack design system. Persistence and offline storage will be
          connected in later milestones.
        </p>
      </div>

      {previewSubmitted ? (
        <Card padding="md" className="border-emerald-200 bg-emerald-50/70">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-950">
                Form validation passed (Preview Mode)
              </p>
              <p className="text-sm text-emerald-900">
                No record was saved because real report creation, IndexedDB queuing, and backend
                persistence belong to subsequent tasks.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="Issue Title"
            placeholder="e.g., Coolant pressure drop on Pump B2"
            value={values.title}
            onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))}
            error={errors.title}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={values.category}
              onChange={(e) => setValues((prev) => ({ ...prev, category: e.target.value }))}
              options={[
                { value: 'electrical', label: 'Electrical' },
                { value: 'mechanical', label: 'Mechanical' },
                { value: 'structural', label: 'Structural' },
                { value: 'safety', label: 'Safety Hazard' },
                { value: 'environmental', label: 'Environmental' },
              ]}
              required
            />

            <Select
              label="Severity"
              value={values.severity}
              onChange={(e) => setValues((prev) => ({ ...prev, severity: e.target.value }))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Site / Location"
              placeholder="e.g., Substation North · Bay 2"
              value={values.location}
              onChange={(e) => setValues((prev) => ({ ...prev, location: e.target.value }))}
              error={errors.location}
              required
            />

            <Input
              label="Asset Tag (Optional)"
              placeholder="e.g., PUMP-B2-09"
              value={values.assetId}
              onChange={(e) => setValues((prev) => ({ ...prev, assetId: e.target.value }))}
            />
          </div>

          <Textarea
            label="Detailed Observation"
            placeholder="Describe field conditions, gauge readings, or immediate safety precautions..."
            rows={5}
            value={values.description}
            onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
            error={errors.description}
            required
          />

          {/* Explicit placeholder boundary for Task 1: no photo uploads yet */}
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 shrink-0">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Photo Attachments</p>
              <p className="text-xs text-slate-500">
                Photo uploads and offline image caching will be implemented in a later milestone.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Link
              to={`/reports?view=${activeView}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <Button type="submit" size="md">
              Validate Preview Form
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );

  const renderWithLayout = (node: ReactNode) =>
    activeView === 'worker' ? (
      <WorkerLayout>{node}</WorkerLayout>
    ) : (
      <CoordinatorLayout breadcrumb="Create Report">{node}</CoordinatorLayout>
    );

  return renderWithLayout(content);
}
