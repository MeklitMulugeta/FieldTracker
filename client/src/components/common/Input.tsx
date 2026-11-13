import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leftIcon,
  id,
  className,
  required,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
          {label}
          {required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            {leftIcon}
          </span>
        ) : null}
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'block w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600',
            leftIcon ? 'pl-10' : '',
            error ? 'border-red-400 focus-visible:outline-red-600' : 'border-slate-300 hover:border-slate-400',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
