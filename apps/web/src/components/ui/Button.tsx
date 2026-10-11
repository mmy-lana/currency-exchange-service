import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium select-none touch-target transition-colors duration-150 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-emerald-accent)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles = {
    md: 'min-h-[48px] px-4 py-2 text-sm',
    lg: 'min-h-[52px] px-6 py-3 text-base',
  };

  const variantStyles = {
    primary:
      'bg-[var(--color-emerald-primary)] text-black font-semibold hover:bg-[var(--color-emerald-accent)] shadow-[0_0_15px_var(--color-emerald-glow)] active:bg-[var(--color-emerald-deep)]',
    secondary:
      'bg-[var(--color-fintech-card)] text-[var(--color-fintech-text-primary)] border border-[var(--color-fintech-border)] hover:bg-[var(--color-fintech-card-hover)] active:bg-[var(--color-fintech-border)]',
    outline:
      'bg-transparent text-[var(--color-emerald-primary)] border border-[var(--color-emerald-primary)] hover:bg-[var(--color-emerald-muted)]',
    ghost:
      'bg-transparent text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-fintech-text-primary)] hover:bg-[var(--color-fintech-card)]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Processing</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
