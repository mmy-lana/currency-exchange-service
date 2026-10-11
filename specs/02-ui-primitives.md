# UI Design System & Atomic Primitives

### Tailwind CSS v4 Theme Specification (`apps/web/src/index.css`)

```css
@import "tailwindcss";

@theme {
  --color-fintech-base: #060908;
  --color-fintech-surface: #0c120e;
  --color-fintech-card: #121a15;
  --color-fintech-card-hover: #17231c;
  --color-fintech-border: #1a2a20;
  --color-fintech-border-bright: #274332;

  --color-emerald-accent: #00e676;
  --color-emerald-primary: #10b981;
  --color-emerald-deep: #059669;
  --color-emerald-glow: rgba(0, 230, 118, 0.15);
  --color-emerald-muted: rgba(16, 185, 129, 0.2);

  --color-fintech-text-primary: #f1f5f3;
  --color-fintech-text-secondary: #8da496;
  --color-fintech-text-muted: #4e6556;

  --color-fintech-danger: #ef4444;
  --color-fintech-warning: #f59e0b;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

:root {
  color-scheme: dark;
  background-color: var(--color-fintech-base);
  color: var(--color-fintech-text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

@utility touch-target {
  min-height: 48px;
  min-width: 48px;
}
```

### Responsive Layout Strategy

- 360px Breakpoint (Ultra-compact mobile):
  - Single column container layout with horizontal padding of 12px (px-3).
  - Minimum vertical touch targets strictly enforced at 48px.
  - Interactive buttons expand to full container width (w-full).
- 390px Breakpoint (Standard mobile):
  - Horizontal padding expanded to 16px (px-4).
  - Inputs maintain clear inline label and symbol anchoring without overlap.
  - Chart height pinned at 200px.
- 430px Breakpoint (Max mobile):
  - Container padding 16px (px-4).
  - Stats card displays 2-column key metrics.
- 768px Breakpoint (Tablet):
  - Dual-panel grid layout (grid grid-cols-12 gap-6).
  - Conversion card takes 5 columns; analytics and historical trends claim 7 columns.
  - Chart height adjusted to 320px.
- 1024px+ Breakpoint (Desktop / Large Displays):
  - Max page width constraint: 1280px (max-w-7xl mx-auto px-8).
  - Multi-column workspace layout.
  - Chart height adjusted to 380px.

### Atomic UI Components Implementation

#### 1. Interactive Button Primitive (`apps/web/src/components/ui/Button.tsx`)
```tsx
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
```

#### 2. FinTech Card Container (`apps/web/src/components/ui/Card.tsx`)
```tsx
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, glow = false, className = '', ...props }) => {
  return (
    <div
      className={`bg-[var(--color-fintech-card)] border border-[var(--color-fintech-border)] rounded-xl p-4 sm:p-6 transition-all duration-200 ${
        glow ? 'border-[var(--color-emerald-primary)] shadow-[0_0_20px_var(--color-emerald-glow)]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
```

#### 3. Touch-Target Form Input (`apps/web/src/components/ui/InputField.tsx`)
```tsx
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
```

#### 4. FinTech Badge Primitive (`apps/web/src/components/ui/Badge.tsx`)
```tsx
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
```

#### 5. Skeleton Primitive (`apps/web/src/components/ui/SkeletonLoader.tsx`)
```tsx
import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

/**
 * Skeleton primitive adhering to standard box sizing dimensions.
 * Numeric dimensions for width/height are coerced to pixel values ('px'); string values are passed intact.
 */
export const SkeletonLoader: React.FC<SkeletonProps> = ({
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const resolveDimension = (val?: string | number): string | undefined => {
    if (val === undefined) return undefined;
    return typeof val === 'number' ? `${val}px` : val;
  };

  return (
    <div
      className={`animate-pulse bg-[var(--color-fintech-border)] rounded-md ${className}`}
      style={{
        width: resolveDimension(width) ?? '100%',
        height: resolveDimension(height) ?? '100%',
        ...style,
      }}
      {...props}
    />
  );
};
```

#### 6. Touch-Target Currency Selector (`apps/web/src/components/ui/CurrencySelector.tsx`)
```tsx
import React from 'react';
import { SupportedCurrency, CurrencyMetadata, SUPPORTED_CURRENCIES } from '@currency-exchange/shared-types';

export interface CurrencySelectorProps {
  id: string;
  label: string;
  value: SupportedCurrency;
  options: readonly SupportedCurrency[];
  metadata?: Partial<Record<SupportedCurrency, CurrencyMetadata>>;
  onChange: (currency: SupportedCurrency) => void;
  className?: string;
}

/**
 * Mobile notice: Native <select> elements delegate to mobile OS sheets (iOS Wheel / Android Dialog).
 * Option-level background colors apply to desktop web browsers and degrade gracefully on mobile.
 */
export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  id,
  label,
  value,
  options,
  metadata,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label htmlFor={id} className="text-xs font-mono tracking-wider text-[var(--color-fintech-text-secondary)] uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const rawVal = e.target.value;
            if ((SUPPORTED_CURRENCIES as readonly string[]).includes(rawVal)) {
              onChange(rawVal as SupportedCurrency);
            }
          }}
          className="w-full min-h-[48px] px-4 py-2 appearance-none bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg text-base font-mono text-[var(--color-fintech-text-primary)] focus:outline-none focus:border-[var(--color-emerald-primary)] focus:ring-1 focus:ring-[var(--color-emerald-primary)] cursor-pointer pr-10"
        >
          {options.map((currency) => {
            const meta = metadata?.[currency];
            const labelText = meta ? `${currency} - ${meta.symbol} (${meta.name})` : currency;
            return (
              <option key={currency} value={currency} className="bg-[var(--color-fintech-card)] text-[var(--color-fintech-text-primary)]">
                {labelText}
              </option>
            );
          })}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-fintech-text-secondary)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
```

#### 7. SVG Sparkline Visualizer (`apps/web/src/components/charts/Sparkline.tsx`)
```tsx
import React from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 40,
  color = 'var(--color-emerald-accent)',
  className = '',
}) => {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 2;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className={`overflow-visible ${className}`} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
```
