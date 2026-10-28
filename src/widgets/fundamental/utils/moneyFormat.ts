/**
 * 펀더멘털 카드들이 공유하는 금액·비율 표기 헬퍼. 값이 없으면 `-`로 통일한다.
 */
import type { Locale } from '@/shared/i18n/locales';
import {
    formatCompactCurrency,
    formatCurrencyForSymbol,
} from '@/shared/lib/priceFormat';

/** 값이 없을 때의 자리표시자. */
export const MISSING_VALUE = '-';

/** 비율(0.12)을 퍼센트(12)로 바꾸는 배율이자 퍼센트 막대 폭의 상한(%). */
export const PERCENT_SCALE = 100;

/** `value`가 `total`에서 차지하는 비율을 소수 첫째 자리까지의 퍼센트 문자열로 만든다. */
export function sharePercent(value: number, total: number): string {
    return ((value / total) * PERCENT_SCALE).toFixed(1);
}

/**
 * 종목 통화로 금액을 표기한다. 통화는 심볼에서, 표기 규칙은 로케일에서 `formatCurrencyForSymbol`이
 * 정한다 — 카드마다 통화를 따로 고르지 않게 한 곳으로 모은다.
 */
export function formatMoney(
    value: number | null,
    symbol: string,
    locale: Locale
): string {
    if (value === null) return MISSING_VALUE;
    return formatCurrencyForSymbol(value, symbol, locale);
}

/** 종목 통화로 큰 금액을 축약 표기한다(`₩333.6조`, `$3.5T`). */
export function formatBigMoney(
    value: number | null,
    symbol: string,
    locale: Locale
): string {
    if (value === null) return MISSING_VALUE;
    return formatCompactCurrency(value, symbol, locale);
}

/** 소수 `digits`자리 고정 표기. `null`·`undefined`는 `-`. */
export function formatFixed(
    value: number | null | undefined,
    digits = 2
): string {
    if (value === null || value === undefined) return MISSING_VALUE;
    return value.toFixed(digits);
}
