import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const variantStyles = {
    success: 'bg-[var(--color-emerald-muted)] text-[var(--color-emerald-accent)] border-[var(--color-emerald-primary)]',
    warning: 'bg-amber-950/40 text-[var(--color-fintech-warning)] border-amber-600/50',
    danger: 'bg-rose-950/40 text-[var(--color-fintech-danger)] border-rose-600/50',
    neutral: 'bg-[var(--color-fintech-surface)] text-[var(--color-fintech-text-secondary)] border-[var(--color-fintech-border)]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
