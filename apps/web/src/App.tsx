import React, { useState } from 'react';
import { SUPPORTED_CURRENCIES, TimeRangeOption, CurrencyMetadata } from '@currency-exchange/shared-types';
import { useExchangeStore } from './store/exchange-store';
import { useExchangeRate } from './hooks/use-exchange-rate';
import { useHistoricalRates } from './hooks/use-historical-rates';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { InputField } from './components/ui/InputField';
import { Badge } from './components/ui/Badge';
import { CurrencySelector } from './components/ui/CurrencySelector';
import { SkeletonLoader } from './components/ui/SkeletonLoader';
import { InteractiveChart } from './components/charts/InteractiveChart';

const METADATA_CATALOG: Record<string, CurrencyMetadata> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', flagCode: 'US', decimalPlaces: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', flagCode: 'EU', decimalPlaces: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', flagCode: 'GB', decimalPlaces: 2 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flagCode: 'JP', decimalPlaces: 0 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flagCode: 'AU', decimalPlaces: 2 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flagCode: 'CA', decimalPlaces: 2 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flagCode: 'CH', decimalPlaces: 2 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flagCode: 'CN', decimalPlaces: 2 },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flagCode: 'HK', decimalPlaces: 2 },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flagCode: 'NZ', decimalPlaces: 2 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flagCode: 'SG', decimalPlaces: 2 },
};

const TIME_RANGES: TimeRangeOption[] = ['7D', '30D', '90D', '1Y'];

export default function App() {
  const {
    fromCurrency,
    toCurrency,
    amount,
    conversionResult,
    isLoading: isConverting,
    errorMessage: conversionError,
    setFromCurrency,
    setToCurrency,
    setAmount,
    swapCurrencies,
  } = useExchangeStore();

  const [selectedRange, setSelectedRange] = useState<TimeRangeOption>('30D');

  useExchangeRate();

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    error: historicalError,
  } = useHistoricalRates({
    base: fromCurrency,
    target: toCurrency,
    range: selectedRange,
  });

  return (
    <div className="min-h-screen bg-[var(--color-fintech-base)] text-[var(--color-fintech-text-primary)] font-sans antialiased">
      <header className="border-b border-[var(--color-fintech-border)] bg-[var(--color-fintech-surface)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-emerald-muted)] border border-[var(--color-emerald-primary)] flex items-center justify-center">
              <span className="text-[var(--color-emerald-accent)] font-mono font-bold text-sm">$</span>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-[var(--color-fintech-text-primary)]">
                FinTech FX Exchange
              </h1>
              <p className="text-xs font-mono text-[var(--color-fintech-text-secondary)] hidden sm:block">
                Sub-millisecond Cross-Rate Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">System Operational</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card glow className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-[var(--color-fintech-border)] pb-3">
                <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--color-fintech-text-secondary)]">
                  Live Currency Converter
                </h2>
                {isConverting ? (
                  <Badge variant="warning">Syncing</Badge>
                ) : (
                  <Badge variant="success">Edge Cached</Badge>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <InputField
                  id="convert-amount"
                  label="Transfer Amount"
                  type="number"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  suffix={fromCurrency}
                />

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <CurrencySelector
                      id="from-currency-select"
                      label="From Currency"
                      value={fromCurrency}
                      options={SUPPORTED_CURRENCIES}
                      metadata={METADATA_CATALOG}
                      onChange={setFromCurrency}
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-center pb-0.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={swapCurrencies}
                      className="w-full sm:w-12 h-12 flex items-center justify-center p-0"
                      aria-label="Swap Currencies"
                    >
                      <svg className="w-5 h-5 text-[var(--color-emerald-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </Button>
                  </div>

                  <div className="sm:col-span-2">
                    <CurrencySelector
                      id="to-currency-select"
                      label="To Currency"
                      value={toCurrency}
                      options={SUPPORTED_CURRENCIES}
                      metadata={METADATA_CATALOG}
                      onChange={setToCurrency}
                    />
                  </div>
                </div>

                {conversionError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-600/50 text-xs font-mono text-[var(--color-fintech-danger)]">
                    {conversionError}
                  </div>
                )}

                <div className="mt-2 p-4 rounded-lg bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] flex flex-col gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fintech-text-muted)]">
                    Estimated Conversion
                  </span>
                  {isConverting ? (
                    <SkeletonLoader height={36} />
                  ) : conversionResult ? (
                    <div>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[var(--color-emerald-accent)]">
                        {conversionResult.convertedAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}{' '}
                        <span className="text-base text-[var(--color-fintech-text-secondary)]">{toCurrency}</span>
                      </div>
                      <div className="text-xs font-mono text-[var(--color-fintech-text-secondary)] mt-1">
                        1 {fromCurrency} = {conversionResult.unitRate.toFixed(6)} {toCurrency}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-mono text-[var(--color-fintech-text-muted)]">
                      Enter an amount to view rate
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <Card className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-fintech-border)] pb-3">
                <div>
                  <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--color-fintech-text-secondary)]">
                    Historical Analytics
                  </h2>
                  <div className="text-lg font-mono font-semibold text-[var(--color-fintech-text-primary)]">
                    {fromCurrency} / {toCurrency}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-[var(--color-fintech-surface)] rounded-lg border border-[var(--color-fintech-border)]">
                  {TIME_RANGES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRange(r)}
                      className={`min-h-[44px] px-3 text-xs font-mono font-medium rounded transition-colors touch-target ${
                        selectedRange === r
                          ? 'bg-[var(--color-emerald-primary)] text-black font-semibold'
                          : 'text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-fintech-text-primary)]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {isHistoricalLoading ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <SkeletonLoader height={54} />
                    <SkeletonLoader height={54} />
                    <SkeletonLoader height={54} />
                  </div>
                  <SkeletonLoader height={280} />
                </div>
              ) : historicalError ? (
                <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-600/50 text-sm font-mono text-[var(--color-fintech-danger)]">
                  {historicalError}
                </div>
              ) : historicalData ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">LOW</div>
                      <div className="text-sm sm:text-base font-mono font-semibold text-[var(--color-fintech-text-primary)]">
                        {historicalData.minRate.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">AVERAGE</div>
                      <div className="text-sm sm:text-base font-mono font-semibold text-[var(--color-fintech-text-primary)]">
                        {historicalData.averageRate.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">HIGH</div>
                      <div className="text-sm sm:text-base font-mono font-semibold text-[var(--color-emerald-accent)]">
                        {historicalData.maxRate.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <InteractiveChart points={historicalData.points} height={280} />
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
