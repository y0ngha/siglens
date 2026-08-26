import {
    currencyForSymbol,
    getDescriptor,
} from '@/shared/config/marketProfile';
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

// "US$1.2조" 형식 (시가총액/현금흐름 등 큰 금액). 포매터 생성은 비싸므로
// 모듈 스코프에 한 번만 만든다 — 렌더마다 new Intl.NumberFormat 금지.
const COMPACT_USD_FORMATTER = new Intl.NumberFormat('ko-KR', {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
});

const COMPACT_KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
    notation: 'compact',
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 1,
});

/**
 * 시가총액·현금흐름 같은 큰 금액을 통화 기호와 함께 축약 표기한다.
 *
 * **통화는 심볼에서 유도한다.** 예전에는 USD로 고정돼 있어서, 국내 상장 종목의 원화
 * 금액이 `시가총액 US$1802.5조`·`목표 주가 US$450,000`처럼 나갔다 — 같은 사이트가
 * 차트 탭에서는 `₩274,500`으로 표시하는 값이다. 금융 정보라 표기 오류의 대가가 크고,
 * 그 페이지들은 색인 대상이다.
 *
 * 심볼을 받는 이유: 호출부는 어차피 심볼을 들고 있고, 통화 판정은 `currencyForSymbol`
 * (`shared/config/marketProfile/registry.ts`) 한 곳에서만 이뤄진다 — `getDescriptor`가
 * 읽는 REGISTRY가 3개 프로필 전체를 exhaustive하게 갖고 있는 유일한 소스라, 새 호출부가
 * 생겨도 그 함수를 호출하기만 하면 자동으로 맞는다(형상 판정이라 조회도 async도 필요 없다).
 */
export function formatCompactCurrency(value: number, symbol: string): string {
    return currencyForSymbol(symbol) === 'KRW'
        ? COMPACT_KRW_FORMATTER.format(value)
        : COMPACT_USD_FORMATTER.format(value);
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

/**
 * "+12.3%" / "-4.5%" — signed percent with one decimal place. Extracted from
 * three byte-identical copies (PositionBuilding/PositionHoldingCard/PositionCard —
 * rule-of-three, DESIGN.md/CONVENTIONS.md dedupe guidance) into a single shared
 * helper next to the other price-formatting utilities.
 */
export function formatSignedPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * "+$12.34" / "-$12.34" — signed USD delta with dynamic-by-magnitude decimals
 * (sub-$1 safe via dynamicDecimals, e.g. "+$0.00012345" for a sub-cent
 * position). Companion to formatSignedPercent for delta displays like
 * unrealized P&L, where formatUsdCurrency's fixed 2dp would flatten small
 * tokens to "$0.00".
 */
export function formatSignedUsd(value: number): string {
    const sign = value >= 0 ? '+' : '-';
    const digits = dynamicDecimals(value);
    const magnitude = Math.abs(value).toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    return `${sign}$${magnitude}`;
}

/**
 * "+₩1,250,000" / "-$12.34" — currency-aware counterpart to `formatSignedUsd`
 * for signed delta displays (e.g. unrealized P&L). Currency is derived from
 * the symbol via `currencyForSymbol` — the same single source `formatAmount`
 * (`widgets/portfolio-position/lib/positionBuildingNotes.ts`) and
 * `PortfolioChip` use, so a hardcoded `$` doesn't leak onto KR-equity
 * symbols (`005930.KS`). KRW has no fractional digits (원화 호가 관례,
 * `KR_EQUITY_DESCRIPTOR.priceFormat.precision`); non-KRW delegates to
 * `formatSignedUsd` for its existing dynamic-by-magnitude precision.
 */
export function formatSignedAmount(value: number, symbol: string): string {
    if (currencyForSymbol(symbol) === 'KRW') {
        const sign = value >= 0 ? '+' : '-';
        const magnitude = Math.abs(value).toLocaleString('en-US', {
            maximumFractionDigits: 0,
        });
        return `${sign}₩${magnitude}`;
    }
    return formatSignedUsd(value);
}

export function formatPriceChange(percent: number): PriceChangeDisplay {
    const isUp = percent >= 0;
    return {
        isUp,
        sign: isUp ? '+' : '',
        colorClass: isUp ? 'text-ui-success-text' : 'text-ui-danger-text',
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
