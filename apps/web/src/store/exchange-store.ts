import { create } from 'zustand';
import { SupportedCurrency, ConversionResult } from '@currency-exchange/shared-types';

interface ExchangeStoreState {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  amount: string;
  conversionResult: ConversionResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastUpdated: number | null;
  setFromCurrency: (currency: SupportedCurrency) => void;
  setToCurrency: (currency: SupportedCurrency) => void;
  setAmount: (amount: string) => void;
  swapCurrencies: () => void;
  setConversionResult: (result: ConversionResult | null) => void;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useExchangeStore = create<ExchangeStoreState>((set, get) => ({
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
    } else {
      set({ fromCurrency });
    }
  },

  setToCurrency: (toCurrency) => {
    if (toCurrency === get().fromCurrency) {
      set({ fromCurrency: get().toCurrency, toCurrency });
    } else {
      set({ toCurrency });
    }
  },

  setAmount: (amount) => set({ amount }),

  swapCurrencies: () =>
    set((state) => ({
      fromCurrency: state.toCurrency,
      toCurrency: state.fromCurrency,
      conversionResult: null,
      errorMessage: null,
    })),

  setConversionResult: (conversionResult) =>
    set({
      conversionResult,
      lastUpdated: conversionResult ? conversionResult.timestamp : null,
      errorMessage: null,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),
  setErrorMessage: (errorMessage) => set({ errorMessage, isLoading: false }),
}));
