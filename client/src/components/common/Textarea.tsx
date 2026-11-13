import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  id,
  rows = 4,
  className,
  required,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={textareaId} className="block text-sm font-medium text-slate-800">
          {label}
          {required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600',
          error ? 'border-red-400 focus-visible:outline-red-600' : 'border-slate-300 hover:border-slate-400',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
