import type { PriceFormatConfig } from '@/shared/config/marketProfile';

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

/** Decimal places for a value under the dynamic-by-magnitude rule. */
export function dynamicDecimals(value: number): number {
    // 비유한값(NaN/Infinity) 방어: log10 경로가 NaN을 반환하면 formatPrice가
    // Intl.NumberFormat에 NaN fraction-digits를 넘겨 RangeError를 던진다.
    if (!Number.isFinite(value)) return 2;
    const abs = Math.abs(value);
    // Single guard covers both >= 1 and >= 1000 (same result, so >= 1000 was dead).
    if (abs >= 1) return 2;
    if (abs === 0) return 2;
    // sub-1: keep ~4 significant figures after the leading zeros
    const leadingZeros = Math.floor(-Math.log10(abs));
    return Math.min(leadingZeros + 4, 12);
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
