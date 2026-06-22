import { getDescriptor } from '@/shared/config/marketProfile';
import type {
    MarketProfileId,
    PriceFormatConfig,
} from '@/shared/config/marketProfile';

type PriceSign = '+' | '';
type PriceArrow = '▲' | '▼';
type PriceArrowLabel = '상승' | '하락';

export interface PriceChangeDisplay {
    isUp: boolean;
    sign: PriceSign;
    colorClass: string;
    arrow: PriceArrow;
    arrowLabel: PriceArrowLabel;
}

export function formatUsdPrice(price: number): string {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// "$123.45" 형식 (Intl currency style, 소수점 2자리 고정).
const USD_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatUsdCurrency(price: number): string {
    return USD_CURRENCY_FORMATTER.format(price);
}

/**
 * Number of significant digits to preserve after the leading zeros when
 * formatting a sub-1 price (e.g. $0.000123 → 4 sig-figs → 8 decimal places).
 * Kept as a named constant so the intent is self-documenting and the value is
 * easy to change in one place.
 */
const DYNAMIC_DECIMAL_SIGNIFICANT_OFFSET = 4;

/**
 * Hard ceiling on decimal places. Prevents absurdly long fraction strings for
 * extremely small values (e.g. $0.0000000000001 → capped at 12).
 */
const MAX_DYNAMIC_DECIMAL_PLACES = 12;

/** Decimal places for a value under the dynamic-by-magnitude rule. */
export function dynamicDecimals(value: number): number {
    // 비유한값(NaN/Infinity) 방어: log10 경로가 NaN을 반환하면 formatPrice가
    // Intl.NumberFormat에 NaN fraction-digits를 넘겨 RangeError를 던진다.
    if (!Number.isFinite(value)) return 2;
    const abs = Math.abs(value);
    // Single guard covers both >= 1 and >= 1000 (same result, so >= 1000 was dead).
    if (abs >= 1) return 2;
    if (abs === 0) return 2;
    const leadingZeros = Math.floor(-Math.log10(abs));
    return Math.min(
        leadingZeros + DYNAMIC_DECIMAL_SIGNIFICANT_OFFSET,
        MAX_DYNAMIC_DECIMAL_PLACES
    );
}

/** Format a price as currency, applying the descriptor's precision rule. */
export function formatPrice(value: number, spec: PriceFormatConfig): string {
    const digits =
        spec.precision.kind === 'fixed'
            ? spec.precision.digits
            : spec.precision.kind === 'integer'
              ? 0
              : dynamicDecimals(value);
    return new Intl.NumberFormat(spec.locale, {
        style: 'currency',
        currency: spec.currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatPriceChange(percent: number): PriceChangeDisplay {
    const isUp = percent >= 0;
    return {
        isUp,
        sign: isUp ? '+' : '',
        colorClass: isUp ? 'text-chart-bullish' : 'text-chart-bearish',
        arrow: isUp ? '▲' : '▼',
        arrowLabel: isUp ? '상승' : '하락',
    };
}

/**
 * Resolve the number of price decimals for a market profile.
 *
 * fixed/integer descriptors are static; dynamic (crypto) derives significant
 * digits from the latest close magnitude so sub-cent tokens aren't flattened.
 *
 * Placed in priceFormat (rather than widgets/) because it is a pure function
 * that depends only on shared/config/marketProfile and dynamicDecimals — no
 * React or widget graph dependency. Co-locating with dynamicDecimals keeps
 * related price-formatting utilities together and allows shared/ consumers to
 * import it without a cross-layer violation.
 *
 * @param marketProfile - The market profile id (e.g. 'us-equity', 'crypto').
 * @param lastClose - The most recent close price; used only for 'dynamic-by-magnitude'
 *   precision. Defaults to 1 (returns 2 decimals) when undefined.
 */
export function resolvePriceDecimals(
    marketProfile: MarketProfileId,
    lastClose: number | undefined
): number {
    const precision = getDescriptor(marketProfile).priceFormat.precision;
    if (precision.kind === 'fixed') return precision.digits;
    if (precision.kind === 'integer') return 0;
    return dynamicDecimals(lastClose ?? 1);
}
