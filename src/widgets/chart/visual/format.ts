import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';
import {
    formatCompactInCurrency,
    formatInCurrency,
    formatSignedPercent,
} from '@/shared/lib/priceFormat';

/** 큰 수 축약(1.2M·1,200만) — 로케일이 단위를 정한다. */
export function compactNumber(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/** 부호가 붙은 축약 수(+1.2M / -300K) — 순매수·순변화처럼 방향이 뜻인 값. */
export function signedCompactNumber(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        notation: 'compact',
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
    }).format(value);
}

/** 통화 금액 축약 — 모르는 통화 코드는 숫자만 축약한다. */
export function compactMoney(
    value: number,
    currency: string,
    locale: Locale
): string {
    return (
        formatCompactInCurrency(value, currency, locale) ??
        compactNumber(value, locale)
    );
}

/** 주당 금액(EPS·배당·행사가) — 축약하지 않는다. */
export function plainMoney(
    value: number,
    currency: string,
    locale: Locale
): string {
    return (
        formatInCurrency(value, currency, locale) ??
        cachedNumberFormat(INTL_LOCALE[locale], {
            maximumFractionDigits: 4,
        }).format(value)
    );
}

/** 소수 `digits`자리 일반 수(비중·비율). */
export function fixedNumber(
    value: number,
    digits: number,
    locale: Locale
): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

/** 최대 소수 둘째 자리의 일반 수(행사가·비중). */
export function plainNumber(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: 2,
    }).format(value);
}

/** 모르는 값(`null`)은 줄표 — 표·막대 제목에서 빈칸이 되지 않게 한다. */
export const NO_VALUE = '-';

/** 부호 있는 등락률 `+1.2%`. */
export const signedPercent = (value: number): string =>
    formatSignedPercent(value, 1);

/** 값이 없을 수 있는 등락률. */
export const signedPercentOrDash = (value: number | null): string =>
    value === null ? NO_VALUE : signedPercent(value);

/** 상승·하락·보합을 색 토큰 클래스로 — 글자색이라 `-text` 짝을 쓴다(DESIGN.md). */
export function changeTextClass(value: number | null): string {
    if (value === null || value === 0) return 'text-secondary-300';
    return value > 0 ? 'text-ui-success-text' : 'text-ui-danger-text';
}

/** 막대 채움색 — 상승·하락 시세 토큰(그래픽, 3:1). */
export const fillClass = (value: number): string =>
    value >= 0 ? 'bg-chart-bullish' : 'bg-chart-bearish';
