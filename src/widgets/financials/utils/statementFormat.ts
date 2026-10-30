/**
 * 재무제표 셀 값의 포맷과 색 — 표와 차트 툴팁이 같은 규칙으로 금액을 표기하게 한다.
 */
import type { Locale } from '@/shared/i18n/locales';
import {
    formatCompactAmount,
    formatCompactInCurrency,
    formatInCurrency,
} from '@/shared/lib/priceFormat';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from './statementCurrency';

/**
 * 셀 값의 종류.
 * - `usd`: 축약 금액('usd'는 "금액" 축을 뜻하는 이름이고 실제 통화는 `currency`가 정한다)
 * - `perShare`: 주당 금액(EPS) — 축약하지 않고 통화·천 단위 구분자를 붙인다
 * - `pct`: 퍼센트
 * - `num`: 단위 없는 수(비율 등)
 */
export type StatementFormat = 'usd' | 'perShare' | 'pct' | 'num';

/** 값이 없을 때 셀에 쓰는 표기. */
export const EMPTY_CELL = '-';

const PCT_FRACTION_DIGITS = 1;
const NUM_FRACTION_DIGITS = 2;

/**
 * 통화 포매터가 코드를 거부하면(`null`) 상장 통화로 표기한다. `deriveStatementCurrency`가
 * 받아들여지는 코드만 넘기므로 직접 코드를 넘기는 호출부의 방어선이다.
 */
function formatCompact(
    value: number,
    currency: StatementCurrency,
    locale: Locale
): string {
    return (
        formatCompactInCurrency(value, currency, locale) ??
        formatCompactAmount(value, DEFAULT_STATEMENT_CURRENCY, locale)
    );
}

function formatPerShare(
    value: number,
    currency: StatementCurrency,
    locale: Locale
): string {
    return (
        formatInCurrency(value, currency, locale) ??
        formatInCurrency(value, DEFAULT_STATEMENT_CURRENCY, locale) ??
        value.toFixed(NUM_FRACTION_DIGITS)
    );
}

/** 값을 소수 첫째 자리 퍼센트로 표기한다("12.5%"). */
export function formatPercent(value: number): string {
    return `${value.toFixed(PCT_FRACTION_DIGITS)}%`;
}

const FORMATTERS: Record<
    StatementFormat,
    (value: number, currency: StatementCurrency, locale: Locale) => string
> = {
    usd: formatCompact,
    perShare: formatPerShare,
    pct: formatPercent,
    num: value => value.toFixed(NUM_FRACTION_DIGITS),
};

/**
 * 값을 종류에 맞춰 표기한다. 값이 없으면 `-`.
 *
 * `locale`에 기본값을 두지 않는다 — 빠뜨린 호출부가 컴파일 단계에서 드러나야 다른 로케일 화면이
 * 한국어 단위(`억`)로 조용히 찍히지 않는다.
 */
export function formatStatementValue(
    value: number | null,
    format: StatementFormat | undefined,
    currency: StatementCurrency,
    locale: Locale
): string {
    if (value === null) return EMPTY_CELL;
    return FORMATTERS[format ?? 'num'](value, currency, locale);
}

/**
 * 값의 부호에 따른 셀 글자색. 값이 없으면 흐린색, `colorize`가 꺼진 행(총자산처럼 크기 자체가
 * 좋고 나쁨이 아닌 값)은 중립색, 그 밖에는 음수 위험 / 양수 성공 / 0 상속.
 */
export function cellToneClass(value: number | null, colorize: boolean): string {
    if (value === null) return 'text-secondary-400';
    if (!colorize) return 'text-secondary-300';
    if (value < 0) return 'text-ui-danger-text';
    if (value > 0) return 'text-ui-success-text';
    return '';
}
