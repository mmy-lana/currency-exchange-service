import React, { useEffect, useRef, useState } from 'react';
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
import { PlatformGuide, hasSeenPlatformGuide, markPlatformGuideSeen } from './components/guide/PlatformGuide';
import { formatExactAmount, formatRate, formatRelativeAge } from './lib/formatters';

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

interface ErrorAlertProps {
  title: string;
  description: string;
  onRetry: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ title, description, onRetry }) => (
  <div
    className="p-4 rounded-lg bg-[var(--color-fintech-surface)] border border-[var(--color-emerald-primary)] shadow-[0_0_15px_var(--color-emerald-glow)] flex flex-col gap-2"
    role="alert"
  >
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-[var(--color-fintech-warning)]" aria-hidden="true" />
      <span className="text-sm font-semibold text-[var(--color-fintech-text-primary)]">{title}</span>
    </div>
    <p className="text-xs font-mono text-[var(--color-fintech-text-secondary)]">{description}</p>
    <Button type="button" variant="outline" onClick={onRetry} className="w-full sm:w-auto self-start mt-1">
      Retry Request
    </Button>
  </div>
);

export default function App() {
  const {
    fromCurrency,
    toCurrency,
    amount,
    conversionResult,
    isLoading: isConverting,
    errorMessage: conversionError,
    lastUpdated,
    setFromCurrency,
    setToCurrency,
    setAmount,
    swapCurrencies,
    requestRetry,
  } = useExchangeStore();

  const [selectedRange, setSelectedRange] = useState<TimeRangeOption>('30D');
  const [historicalRetryNonce, setHistoricalRetryNonce] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const copyResetHandle = useRef<number | null>(null);

  useExchangeRate();

  useEffect(() => {
    if (!hasSeenPlatformGuide()) {
      setIsGuideOpen(true);
      markPlatformGuideSeen();
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        swapCurrencies();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [swapCurrencies]);

  useEffect(() => {
    return () => {
      if (copyResetHandle.current !== null) {
        window.clearTimeout(copyResetHandle.current);
      }
    };
  }, []);

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    error: historicalError,
  } = useHistoricalRates({
    base: fromCurrency,
    target: toCurrency,
    range: selectedRange,
    retryNonce: historicalRetryNonce,
  });

  const handleCopyConverted = async () => {
    if (!conversionResult) return;
    try {
      await navigator.clipboard.writeText(
        `${conversionResult.convertedAmount} ${toCurrency}`
      );
      setCopied(true);
      if (copyResetHandle.current !== null) {
        window.clearTimeout(copyResetHandle.current);
      }
      copyResetHandle.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard permission unavailable: the confirmation badge simply stays hidden.
    }
  };

  const closeGuide = () => setIsGuideOpen(false);

  return (
    <div className="min-h-screen bg-[var(--color-fintech-base)] text-[var(--color-fintech-text-primary)] font-sans antialiased">
      <header className="border-b border-[var(--color-fintech-border)] bg-[var(--color-fintech-surface)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--color-emerald-muted)] border border-[var(--color-emerald-primary)] flex items-center justify-center">
              <span className="text-[var(--color-emerald-accent)] font-mono font-bold text-sm">$</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-[var(--color-fintech-text-primary)] truncate">
                FinTech FX Exchange
              </h1>
              <p className="text-xs font-mono text-[var(--color-fintech-text-secondary)] hidden sm:block">
                Sub-millisecond Cross-Rate Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="success" className="hidden sm:inline-flex">System Operational</Badge>
            <Button type="button" variant="secondary" onClick={() => setIsGuideOpen(true)} className="px-3">
              Platform Guide
            </Button>
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
                  inputMode="decimal"
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
                      className="w-full sm:w-12 min-h-[48px] flex items-center justify-center p-0"
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
                  <ErrorAlert
                    title="Conversion Unavailable"
                    description={conversionError}
                    onRetry={requestRetry}
                  />
                )}

                <div className="mt-2 p-4 rounded-lg bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fintech-text-muted)]">
                      Estimated Conversion
                    </span>
                    {conversionResult && !isConverting && (
                      <span className="text-xs font-mono text-[var(--color-fintech-text-secondary)]">
                        {formatRelativeAge(conversionResult.timestamp, nowTick)}
                      </span>
                    )}
                  </div>
                  {isConverting ? (
                    <SkeletonLoader height={36} />
                  ) : conversionResult ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-2xl sm:text-3xl font-mono font-bold text-[var(--color-emerald-accent)] break-all">
                          {formatExactAmount(conversionResult.convertedAmount, toCurrency)}{' '}
                          <span className="text-base text-[var(--color-fintech-text-secondary)]">{toCurrency}</span>
                        </div>
                        <div className="text-xs font-mono text-[var(--color-fintech-text-secondary)] mt-1">
                          1 {fromCurrency} = {formatRate(conversionResult.unitRate)} {toCurrency}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyConverted}
                        data-testid="copy-converted"
                        aria-label="Copy converted amount"
                        className="min-h-[48px] min-w-[48px] shrink-0 flex items-center justify-center rounded-lg border border-[var(--color-fintech-border)] text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-emerald-accent)] hover:border-[var(--color-emerald-primary)] transition-colors"
                      >
                        {copied ? (
                          <span className="flex items-center gap-1 text-xs font-mono text-[var(--color-emerald-accent)]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Copied
                          </span>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
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
                      data-testid={`range-${r}`}
                      aria-pressed={selectedRange === r}
                      className={`min-h-[48px] min-w-[48px] px-3 text-xs font-mono font-medium rounded transition-colors touch-target ${
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
                <ErrorAlert
                  title="Historical Data Unavailable"
                  description={`${historicalError} The upstream timeseries authority may be unreachable. Retry to request a fresh series.`}
                  onRetry={() => setHistoricalRetryNonce((n) => n + 1)}
                />
              ) : historicalData ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">LOW</div>
                      <div className="text-xs sm:text-base font-mono font-semibold text-[var(--color-fintech-text-primary)] truncate min-w-0">
                        {historicalData.minRate.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">AVERAGE</div>
                      <div className="text-xs sm:text-base font-mono font-semibold text-[var(--color-fintech-text-primary)] truncate min-w-0">
                        {historicalData.averageRate.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg">
                      <div className="text-xs font-mono text-[var(--color-fintech-text-muted)]">HIGH</div>
                      <div className="text-xs sm:text-base font-mono font-semibold text-[var(--color-emerald-accent)] truncate min-w-0">
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

      <PlatformGuide open={isGuideOpen} onClose={closeGuide} />
    </div>
  );
}
