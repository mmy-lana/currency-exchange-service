import React from 'react';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  suffix?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  suffix,
  id,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-xs font-mono tracking-wider text-[var(--color-fintech-text-secondary)] uppercase">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          className={`w-full min-h-[48px] px-4 py-2 bg-[var(--color-fintech-surface)] border rounded-lg text-lg font-mono text-[var(--color-fintech-text-primary)] placeholder-[var(--color-fintech-text-muted)] focus:outline-none focus:border-[var(--color-emerald-primary)] focus:ring-1 focus:ring-[var(--color-emerald-primary)] transition-colors ${
            error ? 'border-[var(--color-fintech-danger)]' : 'border-[var(--color-fintech-border)]'
          } ${suffix ? 'pr-14' : ''} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-4 text-sm font-mono text-[var(--color-fintech-text-secondary)] pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-[var(--color-fintech-danger)] mt-0.5">{error}</span>}
    </div>
  );
};
