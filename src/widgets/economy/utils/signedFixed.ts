/**
 * 부호 붙인 고정 소수점 표기 — 표시 자릿수로 반올림한 값으로 부호·0을 판정한다.
 */
import type { Locale } from '@/shared/i18n/locales';
import { formatFixed } from '@/shared/lib/formatNum';

/**
 * 표시 자릿수로 반올림한 값. `-0`은 `0`으로 접는다 — 원값으로 부호를 고르면 `-0.004`가
 * `-0.00`(빨강), `0.003`이 `+0.00`(초록)으로 찍힌다.
 */
export function roundToPrecision(value: number, precision: number): number {
    const rounded = Number(value.toFixed(precision));
    return rounded === 0 ? 0 : rounded;
}

/** 양수면 `+`를 붙인 고정 소수점 문자열. 반올림해 0이면 부호 없이 `0.00`. */
export function formatSignedFixed(
    value: number,
    precision: number,
    locale: Locale
): string {
    const rounded = roundToPrecision(value, precision);
    return `${rounded > 0 ? '+' : ''}${formatFixed(rounded, precision, locale)}`;
}
