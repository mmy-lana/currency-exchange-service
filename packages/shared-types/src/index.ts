export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'HKD',
  'NZD',
  'SGD',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyMetadata {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  flagCode: string;
  decimalPlaces: number;
}

export type ExchangeRateMap = Partial<Record<SupportedCurrency, number>>;

export interface LiveRatesPayload {
  base: SupportedCurrency;
  timestamp: number;
  rates: ExchangeRateMap;
}

export interface ConversionRequest {
  from: SupportedCurrency;
  to: SupportedCurrency;
  amount: number;
}

export interface ConversionResult {
  from: SupportedCurrency;
  to: SupportedCurrency;
  amount: number;
  /**
   * Exact decimal contract: convertedAmount, unitRate, and inverseUnitRate are
   * string-quantized decimal representations emitted by the backend
   * (ROUND_HALF_EVEN, 8dp rates, ISO-4217 minor-unit amounts). Format them via
   * apps/web/src/lib/formatters.ts; do not perform arithmetic on raw floats.
   */
  convertedAmount: string;
  unitRate: string;
  inverseUnitRate: string;
  timestamp: number;
}

export type TimeRangeOption = '7D' | '30D' | '90D' | '1Y';

export interface HistoricalRatePoint {
  date: string;
  timestamp: number;
  rate: number;
}

export interface HistoricalRatesPayload {
  base: SupportedCurrency;
  target: SupportedCurrency;
  range: TimeRangeOption;
  minRate: number;
  maxRate: number;
  averageRate: number;
  percentageChange: number;
  points: HistoricalRatePoint[];
}

export interface ApiEnvelopeMeta {
  timestamp: string;
  cached: boolean;
  cacheTtlSeconds: number;
}

export interface ApiEnvelopeError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiEnvelopeError | null;
  meta: ApiEnvelopeMeta;
}
