export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { value: 'CNY', label: 'CNY (¥)', symbol: '¥' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['value'];

export interface ExchangeRate {
  id?: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string;
}

export interface ExchangeRateOverride {
  id?: number;
  month: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_OPTIONS.find((c) => c.value === code)?.symbol || code;
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[]
): number {
  if (fromCurrency === toCurrency || !amount) return amount;
  const rate = rates.find(
    (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
  );
  if (!rate) return amount;
  return Math.round(amount * rate.rate * 100) / 100;
}

/** 优先使用月度汇率，再使用默认汇率 */
export function convertAmountWithOverrides(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  defaultRates: ExchangeRate[],
  monthlyOverrides: ExchangeRateOverride[],
  month: string
): number {
  if (fromCurrency === toCurrency || !amount) return amount;
  // 优先查月度汇率
  const monthly = monthlyOverrides.find(
    (r) => r.month === month && r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
  );
  if (monthly) {
    return Math.round(amount * monthly.rate * 100) / 100;
  }
  // 回退到默认汇率
  return convertAmount(amount, fromCurrency, toCurrency, defaultRates);
}

export function formatCurrency(
  amount: number | undefined | null,
  currencySymbol: string
): string {
  if (amount === undefined || amount === null) return '-';
  return `${currencySymbol}${amount.toFixed(2)}`;
}