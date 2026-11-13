import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
}

export function Select({
  label,
  hint,
  error,
  options,
  id,
  className,
  required,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-800">
          {label}
          {required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'block w-full min-h-[44px] appearance-none rounded-lg border bg-white pl-3.5 pr-10 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-600 cursor-pointer',
            error ? 'border-red-400 focus-visible:outline-red-600' : 'border-slate-300 hover:border-slate-400',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
          aria-hidden="true"
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
