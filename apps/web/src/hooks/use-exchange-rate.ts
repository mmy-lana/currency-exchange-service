import { useEffect, useRef } from 'react';
import { ConversionResult } from '@currency-exchange/shared-types';
import { useExchangeStore } from '../store/exchange-store';
import { fetchJson } from '../lib/api-client';
import { INPUT_DEBOUNCE_MS } from '../lib/utils';

export function useExchangeRate() {
  const {
    fromCurrency,
    toCurrency,
    amount,
    retryNonce,
    setConversionResult,
    setIsLoading,
    setErrorMessage,
  } = useExchangeStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setConversionResult(null);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const result = await fetchJson<ConversionResult>(
          `/v1/convert?from=${fromCurrency}&to=${toCurrency}&amount=${numericAmount}`,
          { signal: controller.signal }
        );
        setConversionResult(result);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Conversion query failed';
        setErrorMessage(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, INPUT_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrency, toCurrency, amount, retryNonce]);
}
