import { useEffect, useState, useRef } from 'react';
import { SupportedCurrency, TimeRangeOption, HistoricalRatesPayload } from '@currency-exchange/shared-types';
import { fetchJson } from '../lib/api-client';

export interface UseHistoricalRatesProps {
  base: SupportedCurrency;
  target: SupportedCurrency;
  range: TimeRangeOption;
  /** Incrementing nonce that forces a refetch (manual Retry Request action). */
  retryNonce?: number;
}

export function useHistoricalRates({ base, target, range, retryNonce = 0 }: UseHistoricalRatesProps) {
  const [data, setData] = useState<HistoricalRatesPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    async function loadHistoricalData() {
      try {
        const payload = await fetchJson<HistoricalRatesPayload>(
          `/v1/rates/historical?base=${base}&target=${target}&range=${range}`,
          { signal: controller.signal }
        );
        setData(payload);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to fetch historical series';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadHistoricalData();

    return () => {
      controller.abort();
    };
  }, [base, target, range, retryNonce]);

  return { data, isLoading, error };
}
