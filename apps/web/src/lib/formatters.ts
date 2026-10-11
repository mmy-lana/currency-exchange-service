import { SupportedCurrency } from '@currency-exchange/shared-types';

/**
 * Decimal-safe presentation formatters.
 *
 * Backend monetary values arrive as string-quantized decimals
 * (ROUND_HALF_EVEN, 8dp rates, ISO-4217 minor-unit amounts). Number() is used
 * strictly for presentation of an already-quantized value, never for further
 * arithmetic.
 */

export const CURRENCY_MINOR_UNITS: Record<SupportedCurrency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  HKD: 2,
  NZD: 2,
  SGD: 2,
};

export function formatExactAmount(
  quantized: string,
  currency: SupportedCurrency
): string {
  const value = Number(quantized);
  if (Number.isNaN(value)) {
    return quantized;
  }
  const minorUnits = CURRENCY_MINOR_UNITS[currency];
  return value.toLocaleString(undefined, {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: Math.max(minorUnits, 4),
  });
}

export function formatRate(quantized: string, places = 6): string {
  const value = Number(quantized);
  if (Number.isNaN(value)) {
    return quantized;
  }
  return value.toFixed(places);
}

export function formatRelativeAge(timestampMs: number, nowMs: number = Date.now()): string {
  const ageSeconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (ageSeconds < 60) {
    return `Updated ${ageSeconds}s ago`;
  }
  const ageMinutes = Math.floor(ageSeconds / 60);
  return `Updated ${ageMinutes}m ${ageSeconds % 60}s ago`;
}
