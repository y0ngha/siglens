import 'server-only';
import {
    AGENT_HISTORY_INDICES,
    AGENT_PRICE_STATS_DEFAULT_PERIOD,
    AGENT_PRICE_STATS_MAX_DATES,
    AGENT_PRICE_STATS_MAX_SUBJECTS,
    AGENT_PRICE_STATS_PERIODS,
    isIsoDate,
    type AgentHistoryIndex,
    type AgentPriceStatsPeriod,
    type PriceStatsRequest,
    type PriceStatsWindowRequest,
} from '@y0ngha/siglens-core';

/** `year`가 받는 범위. 스펙(`get_price_stats`)의 `minimum`·`maximum`과 같은 값이다. */
export const PRICE_STATS_YEAR_MIN = 1971;
export const PRICE_STATS_YEAR_MAX = 2100;

export type PriceStatsArgument =
    | 'symbols'
    | 'index'
    | 'period'
    | 'year'
    | 'from'
    | 'to'
    | 'dates'
    | 'subjects';

/** 인자 오류 — 자르거나 고쳐 쓰지 않고 어느 인자를 고칠지 알려 거절한다. */
export interface PriceStatsInvalidArgs {
    error: 'invalid_args';
    argument: PriceStatsArgument;
    reason: string;
}

export interface ParsedPriceStatsArgs {
    /** 대문자로 바꾸고 중복을 뺀 심볼, 입력 순서. */
    symbols: string[];
    index: AgentHistoryIndex | null;
    request: PriceStatsRequest;
}

const invalid = (
    argument: PriceStatsArgument,
    reason: string
): PriceStatsInvalidArgs => ({ error: 'invalid_args', argument, reason });

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function isNonEmptyStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.every(item => typeof item === 'string' && item.trim().length > 0)
    );
}

function isHistoryIndex(value: unknown): value is AgentHistoryIndex {
    return AGENT_HISTORY_INDICES.some(index => index === value);
}

function isPeriod(value: unknown): value is AgentPriceStatsPeriod {
    return AGENT_PRICE_STATS_PERIODS.some(period => period === value);
}

function windowOf(input: {
    from: string | undefined;
    to: string | undefined;
    year: number | undefined;
    period: AgentPriceStatsPeriod | undefined;
    hasDates: boolean;
}): PriceStatsWindowRequest {
    if (input.from !== undefined)
        return { kind: 'range', from: input.from, to: input.to ?? null };
    if (input.year !== undefined) return { kind: 'year', year: input.year };
    if (input.period !== undefined)
        return { kind: 'period', period: input.period };
    // 날짜만 물었으면 창 없이 그 날짜들의 종가만 돌려준다. 아무것도 없으면 기본 창.
    return input.hasDates
        ? { kind: 'none' }
        : { kind: 'period', period: AGENT_PRICE_STATS_DEFAULT_PERIOD };
}

const isDateString = (value: unknown): value is string =>
    typeof value === 'string' && isIsoDate(value);

const isValidYear = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= PRICE_STATS_YEAR_MIN &&
    value <= PRICE_STATS_YEAR_MAX;

/**
 * `get_price_stats` 인자를 읽는다. 창 인자는 `from` > `year` > `period` 순으로 하나만 쓰고 덮인 인자는 `ignored`로 core에 넘겨
 * 결과 `notes`가 알리게 한다. 주체(종목 + 지수)가 없거나 `AGENT_PRICE_STATS_MAX_SUBJECTS`를 넘거나 날짜가
 * `AGENT_PRICE_STATS_MAX_DATES`를 넘으면 자르지 않고 거절한다. 날짜는 `isIsoDate`(달력에 있는 날)만 받는다.
 */
export function parsePriceStatsArgs(
    args: Record<string, unknown>
): ParsedPriceStatsArgs | PriceStatsInvalidArgs {
    const { symbols: rawSymbols, index, period, year, from, to, dates } = args;
    if (rawSymbols !== undefined && !isNonEmptyStringArray(rawSymbols))
        return invalid('symbols', 'symbols must be an array of ticker strings');
    if (index !== undefined && !isHistoryIndex(index))
        return invalid(
            'index',
            `index must be one of ${AGENT_HISTORY_INDICES.join(', ')}`
        );
    const symbols = unique(
        (rawSymbols ?? []).map(symbol => symbol.trim().toUpperCase())
    );
    const subjectCount = symbols.length + (index === undefined ? 0 : 1);
    if (subjectCount === 0)
        return invalid('subjects', 'pass at least one symbol or an index');
    if (subjectCount > AGENT_PRICE_STATS_MAX_SUBJECTS)
        return invalid(
            'subjects',
            `at most ${AGENT_PRICE_STATS_MAX_SUBJECTS} subjects (symbols plus index) per call, got ${subjectCount}`
        );

    if (period !== undefined && !isPeriod(period))
        return invalid(
            'period',
            `period must be one of ${AGENT_PRICE_STATS_PERIODS.join(', ')}`
        );
    if (year !== undefined && !isValidYear(year))
        return invalid(
            'year',
            `year must be an integer from ${PRICE_STATS_YEAR_MIN} to ${PRICE_STATS_YEAR_MAX}`
        );
    if (from !== undefined && !isDateString(from))
        return invalid('from', 'from must be a real date as YYYY-MM-DD');
    if (to !== undefined && !isDateString(to))
        return invalid('to', 'to must be a real date as YYYY-MM-DD');
    if (to !== undefined && from === undefined)
        return invalid('to', 'to needs from; pass both or neither');
    if (from !== undefined && to !== undefined && from > to)
        return invalid('from', 'from is after to');
    if (
        dates !== undefined &&
        !(isNonEmptyStringArray(dates) && dates.every(isIsoDate))
    )
        return invalid(
            'dates',
            'dates must be an array of real dates as YYYY-MM-DD'
        );
    const uniqueDates = unique(dates ?? []);
    if (uniqueDates.length > AGENT_PRICE_STATS_MAX_DATES)
        return invalid(
            'dates',
            `at most ${AGENT_PRICE_STATS_MAX_DATES} dates per call, got ${uniqueDates.length}`
        );

    // 가장 구체적인 하나만 쓴다. `from`이 있으면 year·period가, year가 있으면 period가 덮인다.
    const ignored: ('period' | 'year')[] = [
        ...(from !== undefined && year !== undefined ? ['year' as const] : []),
        ...((from !== undefined || year !== undefined) && period !== undefined
            ? ['period' as const]
            : []),
    ];
    return {
        symbols,
        index: index ?? null,
        request: {
            window: windowOf({
                from,
                to,
                year,
                period,
                hasDates: uniqueDates.length > 0,
            }),
            dates: uniqueDates,
            ignored,
        },
    };
}
