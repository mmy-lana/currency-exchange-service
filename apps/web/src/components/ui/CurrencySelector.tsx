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
