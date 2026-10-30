/**
 * 스코어카드 지표 값의 단위별 포맷.
 */
import type { ScoreMetricUnit } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import type { StatementCurrency } from './statementCurrency';
import {
    EMPTY_CELL,
    formatPercent,
    formatStatementValue,
} from './statementFormat';

/** 비율 지표의 소수 자릿수. */
const RATIO_FRACTION_DIGITS = 2;

/** 단위 → 값 포매터. 금액 단위('usd')만 통화와 로케일이 필요하다. */
const METRIC_FORMATTERS: Record<
    ScoreMetricUnit,
    (value: number, currency: StatementCurrency, locale: Locale) => string
> = {
    pct: formatPercent,
    ratio: value => `${value.toFixed(RATIO_FRACTION_DIGITS)}x`,
    // 'usd'는 "금액" 단위를 뜻하는 이름이다 — 실제 통화는 `currency`가 정한다.
    usd: (value, currency, locale) =>
        formatStatementValue(value, 'usd', currency, locale),
    score: value => String(Math.round(value)),
};

/**
 * 지표 값을 단위에 맞춰 표기한다: `pct` → "12.5%", `ratio` → "2.1x", `usd` → 축약 금액,
 * `score` → 반올림 정수. 값이 없으면 `-`.
 */
export function formatMetricValue(
    value: number | null,
    unit: ScoreMetricUnit,
    currency: StatementCurrency,
    locale: Locale
): string {
    if (value === null) return EMPTY_CELL;
    return METRIC_FORMATTERS[unit](value, currency, locale);
}
