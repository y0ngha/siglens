import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';

/**
 * 수급 화면의 숫자 포맷. 로케일은 호출부가 `useResolvedLocale()`로 얻어 넘긴다 — 한국어는 억·만,
 * 영어는 M·B로 로케일이 알아서 줄여 주므로 단위 문자열을 코드에 두지 않는다.
 */

/** 큰 수를 짧게(`1.4억`, `142M`). 소수 한 자리까지. */
export function formatCompact(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/** 부호를 항상 붙인 축약 수(`+1.4억`, `-48M`). 0은 부호 없이 `0`. */
export function formatSignedCompact(value: number, locale: Locale): string {
    if (value === 0) return formatCompact(0, locale);
    const body = formatCompact(Math.abs(value), locale);
    return `${value > 0 ? '+' : '-'}${body}`;
}

/** 쉼표 구분 정수(`5,240`). */
export function formatInteger(value: number, locale: Locale): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: 0,
    }).format(value);
}

/** 달러 금액을 짧게(`$1.2M`). 음수는 앞에 `-`. */
export function formatUsdCompact(value: number, locale: Locale): string {
    const body = cachedNumberFormat(INTL_LOCALE[locale], {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(Math.abs(value));
    return value < 0 ? `-${body}` : body;
}

/** 소수 `digits`자리 퍼센트(`12.3%`). 값은 이미 퍼센트 단위(12.3)다. */
export function formatPercent(
    value: number,
    locale: Locale,
    digits = 1
): string {
    return `${cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value)}%`;
}

/** 부호를 항상 붙인 퍼센트(`+2.5%`, `-0.4%`). 0은 `0.0%`. */
export function formatSignedPercent(
    value: number,
    locale: Locale,
    digits = 1
): string {
    const body = formatPercent(Math.abs(value), locale, digits);
    if (value === 0) return body;
    return `${value > 0 ? '+' : '-'}${body}`;
}

/** 소수 한 자리 수(`2.2`). */
export function formatDecimal(
    value: number,
    locale: Locale,
    digits = 1
): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

/** 부호를 항상 붙인 소수(`+5.4`, `-0.8`). 0은 부호 없이. 점수(-100~+100) 표기에 쓴다. */
export function formatSignedDecimal(
    value: number,
    locale: Locale,
    digits = 1
): string {
    const body = formatDecimal(Math.abs(value), locale, digits);
    const factor = 10 ** digits;
    if (Math.round(Math.abs(value) * factor) === 0) return body;
    return `${value > 0 ? '+' : '-'}${body}`;
}

/**
 * 분기말(`2026-06-30`) → 짧은 표기. ISO 날짜를 로케일 없이 그대로 쓰는 편이 4개 로케일에서 가장 모호하지
 * 않지만, 막대 그래프 눈금은 좁아서 `'26.06`처럼 줄인다.
 */
export function formatPeriodShort(period: string): string {
    const [year, month] = period.split('-');
    if (year === undefined || month === undefined) return period;
    return `'${year.slice(2)}.${month}`;
}

/** `MM-DD`(눈금용). 형식이 다르면 원문. */
export function formatMonthDay(isoDate: string): string {
    const [, month, day] = isoDate.split('-');
    if (month === undefined || day === undefined) return isoDate;
    return `${month}-${day}`;
}
