import { useEffect, useState, useRef } from 'react';
import { fetchJson } from '../lib/api-client';
export function useHistoricalRates({ base, target, range }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);
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
                const payload = await fetchJson(`/v1/rates/historical?base=${base}&target=${target}&range=${range}`, { signal: controller.signal });
                setData(payload);
            }
            catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                const message = err instanceof Error ? err.message : 'Failed to fetch historical series';
                setError(message);
            }
            finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }
        loadHistoricalData();
        return () => {
            controller.abort();
        };
    }, [base, target, range]);
    return { data, isLoading, error };
}
