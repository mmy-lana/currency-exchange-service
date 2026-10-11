export const INPUT_DEBOUNCE_MS = 300;
export function assertRate(map, currency) {
    const rate = map[currency];
    if (rate === undefined) {
        throw new Error(`Exchange rate unavailable for currency: ${currency}`);
    }
    return rate;
}
