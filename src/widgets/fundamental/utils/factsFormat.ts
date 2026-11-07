/**
 * 펀더멘털 사실 블록의 숫자·날짜 표기. 로케일은 호출부가 반드시 넘긴다(I18-13).
 */
import type { Locale } from '@/shared/i18n/locales';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import {
    cachedDateTimeFormat,
    cachedNumberFormat,
} from '@/shared/lib/intlFormatCache';
import {
    formatCompactAmount,
    formatCompactCurrency,
    formatCompactInCurrency,
    formatCurrencyForSymbol,
} from '@/shared/lib/priceFormat';
import { normalizeReportedCurrency } from '@/shared/lib/reportedCurrency';

/** `YYYY-MM-DD` 날짜 키를 로케일 날짜로. 날짜 키는 달력 날짜라 UTC로 고정해 하루 밀리지 않게 한다. */
export function formatFactDate(dateKey: string, locale: Locale): string {
    const date = new Date(`${dateKey.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return dateKey;
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}

/** 정수 개수(천 단위 구분). 부호가 있으면 `+`/`-`를 붙인다. */
export function formatFactCount(
    value: number,
    locale: Locale,
    signed = false
): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: 0,
        ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    }).format(value);
}

/** 소수 한 자리(현금 소진 연수·공매도 %·상환일수). */
export function formatFactDecimal(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(value);
}

/** 부호 있는 퍼센트, 소수 한 자리(`+12.3%`). 값은 % 단위(12.3 = 12.3%)로 받는다. */
export function formatFactSignedPercent(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        style: 'percent',
        signDisplay: 'exceptZero',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(value / 100);
}

/** 공시 보고 통화 금액(현금·영업현금흐름) — ADR은 본국 통화로 공시하므로 보고 통화를 먼저 쓴다. */
export function formatReportedAmount(
    value: number,
    reportedCurrency: string | null,
    symbol: string,
    locale: Locale
): string {
    const reported = normalizeReportedCurrency(reportedCurrency);
    const inReported =
        reported === null
            ? null
            : formatCompactInCurrency(value, reported, locale);
    return inReported ?? formatCompactCurrency(value, symbol, locale);
}

/** 내부자 거래 금액 — SEC Form 4 금액은 달러다. */
export function formatUsdAmount(value: number, locale: Locale): string {
    return formatCompactAmount(value, 'USD', locale);
}

/** 목표가 — 상장 통화. */
export function formatTargetPrice(
    value: number,
    symbol: string,
    locale: Locale
): string {
    return formatCurrencyForSymbol(value, symbol, locale);
}
