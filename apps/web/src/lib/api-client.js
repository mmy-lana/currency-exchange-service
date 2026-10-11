const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export async function fetchJson(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });
    if (!response.ok) {
        let errorMessage = `HTTP request failed: ${response.status} ${response.statusText}`;
        try {
            const errorEnvelope = (await response.json());
            if (errorEnvelope.error?.message) {
                errorMessage = errorEnvelope.error.message;
            }
        }
        catch {
            // Retain fallback HTTP status text if response is non-JSON
        }
        throw new Error(errorMessage);
    }
    const envelope = (await response.json());
    if (!envelope.success || envelope.data === null || envelope.data === undefined) {
        throw new Error(envelope.error?.message || 'Unexpected service envelope error.');
    }
    return envelope.data;
}
