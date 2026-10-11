import { useEffect, useRef } from 'react';
import { ConversionResult } from '@currency-exchange/shared-types';
import { useExchangeStore } from '../store/exchange-store';
import { fetchJson, TimeoutError } from '../lib/api-client';
import { INPUT_DEBOUNCE_MS } from '../lib/utils';

// DATA-02: strict positive-decimal pattern; the exact user string is forwarded
// to the API so no IEEE-754 parseFloat conversion or scientific notation ever
// occurs on the request path.
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

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
    const trimmedAmount = amount.trim();
    if (!trimmedAmount || trimmedAmount === '0' || !AMOUNT_PATTERN.test(trimmedAmount)) {
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
          `/v1/convert?from=${fromCurrency}&to=${toCurrency}&amount=${encodeURIComponent(trimmedAmount)}`,
          { signal: controller.signal }
        );
        setConversionResult(result);
      } catch (err: unknown) {
        // DEF-01: only an intentionally aborted caller signal is silent. A
        // timeout abort surfaces an explicit, retryable error message.
        if (controller.signal.aborted && err instanceof DOMException && err.name === 'AbortError') {
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
