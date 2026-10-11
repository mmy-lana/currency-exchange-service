import { create } from 'zustand';
export const useExchangeStore = create((set, get) => ({
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    amount: '1000',
    conversionResult: null,
    isLoading: false,
    errorMessage: null,
    lastUpdated: null,
    setFromCurrency: (fromCurrency) => {
        if (fromCurrency === get().toCurrency) {
            set({ toCurrency: get().fromCurrency, fromCurrency });
        }
        else {
            set({ fromCurrency });
        }
    },
    setToCurrency: (toCurrency) => {
        if (toCurrency === get().fromCurrency) {
            set({ fromCurrency: get().toCurrency, toCurrency });
        }
        else {
            set({ toCurrency });
        }
    },
    setAmount: (amount) => set({ amount }),
    swapCurrencies: () => set((state) => ({
        fromCurrency: state.toCurrency,
        toCurrency: state.fromCurrency,
        conversionResult: null,
        errorMessage: null,
    })),
    setConversionResult: (conversionResult) => set({
        conversionResult,
        lastUpdated: conversionResult ? conversionResult.timestamp : null,
        errorMessage: null,
    }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setErrorMessage: (errorMessage) => set({ errorMessage, isLoading: false }),
}));
