import { ApiResponse } from '@currency-exchange/shared-types';

/**
 * Same-origin transport contract: when VITE_API_URL is unset, requests use
 * relative paths so the Vite dev proxy (or the production edge) terminates
 * the API hop and the browser never performs a cross-origin call. An explicit
 * VITE_API_URL still wins for split-host deployments.
 */
const BASE_URL = import.meta.env.VITE_API_URL || '';

const REQUEST_TIMEOUT_MS = 8000;

export async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Compose the caller's signal with the timeout boundary: aborting either
  // signal cancels the request.
  const composedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
      signal: composedSignal,
    });

    if (!response.ok) {
      let errorMessage = `HTTP request failed: ${response.status} ${response.statusText}`;
      let errorCode = `HTTP_${response.status}`;
      try {
        const errorEnvelope = (await response.json()) as ApiResponse<null>;
        if (errorEnvelope.error?.message) {
          errorMessage = errorEnvelope.error.message;
        }
        if (errorEnvelope.error?.code) {
          errorCode = errorEnvelope.error.code;
        }
      } catch {
        // Retain fallback HTTP status text if response is non-JSON
      }
      const requestError = new Error(errorMessage) as Error & { code?: string };
      requestError.code = errorCode;
      throw requestError;
    }

    const envelope = (await response.json()) as ApiResponse<T>;
    if (!envelope.success || envelope.data === null || envelope.data === undefined) {
      throw new Error(envelope.error?.message || 'Unexpected service envelope error.');
    }

    return envelope.data;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
