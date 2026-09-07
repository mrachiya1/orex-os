/**
 * Real ISO-4217 membership check for Project Value's currency_code
 * (prompts/017-clients-intelligence-v1.md, founder decision 3). The
 * database CHECK constraint only validates shape (3 uppercase letters,
 * supabase/migrations/0040) -- this curated list is the actual business
 * validation boundary, matching how this repo already splits DB-level shape
 * constraints from application-level rules (e.g. internal_notes_
 * classification). Deliberately a fixed common-currency list, not every
 * ISO-4217 code that has ever existed -- extend as real client currencies
 * come up rather than pre-seeding all ~180.
 */
export const SUPPORTED_CURRENCY_CODES = [
  "USD", "EUR", "GBP", "LKR", "INR", "AUD", "CAD", "NZD", "SGD", "AED",
  "JPY", "CNY", "CHF", "ZAR", "HKD", "SEK", "NOK", "DKK", "PKR", "BDT",
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_CURRENCY_CODES);

export function isSupportedCurrencyCode(code: string): code is SupportedCurrencyCode {
  return SUPPORTED_SET.has(code);
}

/**
 * Formats integer minor units (e.g. 350000 + "USD") as a display string
 * (e.g. "USD 3,500.00"). Never does currency conversion -- money in
 * different currencies is always shown separately, never summed
 * (prompts/017-clients-intelligence-v1.md "Client Value Derivation").
 */
export function formatMoney(minorUnits: number, currencyCode: string): string {
  const major = minorUnits / 100;
  const formatted = major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currencyCode} ${formatted}`;
}
