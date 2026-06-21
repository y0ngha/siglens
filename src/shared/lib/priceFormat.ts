import type { PricePrecision } from '@/shared/config/marketProfile';

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
    const abs = Math.abs(value);
    if (abs >= 1000) return 2;
    if (abs >= 1) return 2;
    if (abs === 0) return 2;
    // sub-1: keep ~4 significant figures after the leading zeros
    const leadingZeros = Math.floor(-Math.log10(abs));
    return Math.min(leadingZeros + 4, 12);
}

interface PriceFormatSpec {
    currency: 'USD';
    locale: string;
    precision: PricePrecision;
}

/** Format a price as currency, applying the descriptor's precision rule. */
export function formatPrice(value: number, spec: PriceFormatSpec): string {
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
