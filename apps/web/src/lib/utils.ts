import { SupportedCurrency } from '@currency-exchange/shared-types';

export const INPUT_DEBOUNCE_MS = 300;

export function assertRate(
  map: Partial<Record<SupportedCurrency, number>>,
  currency: SupportedCurrency
): number {
  const rate = map[currency];
  if (rate === undefined) {
    throw new Error(`Exchange rate unavailable for currency: ${currency}`);
  }
  return rate;
}
