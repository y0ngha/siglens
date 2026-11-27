import 'server-only';
import type { QuoteSummaryModules } from 'yahoo-finance2/modules/quoteSummary';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { sym } from '@/shared/api/fmp/symKey';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { toYahooSymbol } from '@/shared/lib/yahooSymbol';
import { getYahooClient } from './createYahooClient';
import { stringOrNull, toIsoOrNull } from './yahooValues';

const yahooFinance = getYahooClient();

/** 요약 캐시 TTL. 목표가·의견 변경은 하루 몇 번 바뀌는 수준이라 1시간이면 충분하다. */
const ANALYST_SUMMARY_TTL_SECONDS = SECONDS_PER_HOUR;

/**
 * 캐시에 남기는 변경 이력의 하한: 최근 90일은 전부(엔티티의 30·90일 집계가 이 창을 쓴다), 그보다 오래된
 * 행은 최신 15건까지만(도구가 보여 주는 행 수). Yahoo는 300~1,000행을 주고 그중 대부분은 몇 년 묵은 것이라
 * 그대로 캐시하면 1시간 TTL 동안 매 조회마다 수백 KB를 Redis에서 내려받는다.
 */
const ACTION_CACHE_WINDOW_DAYS = 90;
const ACTION_CACHE_MIN_ROWS = 15;

/** Yahoo `recommendationTrend`에서 "이번 달" 분포를 가리키는 period 값. */
const CURRENT_TREND_PERIOD = '0m';

export interface YahooAnalystTargets {
    mean: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
    analysts: number | null;
}

export interface YahooAnalystTrend {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

/**
 * `upgradeDowngradeHistory` 한 행. 날짜는 Redis(JSON) 왕복을 견디도록 ISO 문자열이고,
 * 문자열 필드는 원문 그대로다(의미 해석은 `entities/analyst-views`의 순수 함수가 한다).
 * 목표가 "없음"은 Yahoo가 `0`으로 주므로 여기서는 값을 바꾸지 않는다.
 */
export interface YahooRawAnalystAction {
    dateIso: string | null;
    firm: string | null;
    fromGrade: string | null;
    toGrade: string | null;
    action: string | null;
    priceTargetAction: string | null;
    priorPriceTarget: number | null;
    currentPriceTarget: number | null;
}

export interface YahooEarningsHint {
    /** `earningsDate` 배열의 첫 원소. 발표 후에도 Yahoo는 지난 날짜를 그대로 둔다. */
    dateIso: string | null;
    /** 지난 분기 콜 날짜가 남아 있을 수 있다 — 소비자가 발표일과 대조한다. */
    callDateIso: string | null;
    isEstimate: boolean | null;
}

/** `earningsTrend` 한 기간(원문 그대로, 날짜만 ISO 날짜). 값이 없으면 `null`. */
export interface YahooEstimatePeriod {
    /** `0q`·`+1q`·`0y`·`+1y`. */
    period: string;
    /** 기간 마지막 날 `YYYY-MM-DD`. */
    endDate: string | null;
    epsAvg: number | null;
    epsAnalysts: number | null;
    eps7dAgo: number | null;
    eps30dAgo: number | null;
    eps60dAgo: number | null;
    eps90dAgo: number | null;
    up7d: number | null;
    down7d: number | null;
    up30d: number | null;
    down30d: number | null;
    revenueAvg: number | null;
    revenueAnalysts: number | null;
    /** 소수(0.25 = 25%). */
    revenueGrowth: number | null;
}

/** JSON 직렬화 가능한 애널리스트 요약. 캐시에 그대로 들어간다. */
export interface YahooAnalystSummary {
    targets: YahooAnalystTargets;
    trend: YahooAnalystTrend | null;
    /** `null`은 요청하지 않았다는 뜻이고, `[]`는 이력이 없다는 뜻이다. */
    actions: YahooRawAnalystAction[] | null;
    earnings: YahooEarningsHint | null;
    /** 실적 추정치 추이. 요청하지 않았거나 Yahoo가 주지 않으면 `[]`. */
    estimates: YahooEstimatePeriod[];
}

/** 추정치를 싣는 기간 — 이번·다음 분기, 이번·다음 회계연도. `-1q` 같은 지난 기간은 버린다. */
const ESTIMATE_PERIODS: ReadonlySet<string> = new Set([
    '0q',
    '+1q',
    '0y',
    '+1y',
]);

function mapEstimates(raw: unknown): YahooEstimatePeriod[] {
    const rows = asRecord(raw)?.trend;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(item => {
        const row = asRecord(item);
        const period = stringOrNull(row?.period);
        if (row === null || period === null || !ESTIMATE_PERIODS.has(period))
            return [];
        const eps = asRecord(row.earningsEstimate);
        const trend = asRecord(row.epsTrend);
        const revisions = asRecord(row.epsRevisions);
        const revenue = asRecord(row.revenueEstimate);
        return [
            {
                period,
                endDate: toIsoOrNull(row.endDate)?.slice(0, 10) ?? null,
                epsAvg: toFiniteNumber(eps?.avg),
                epsAnalysts: toFiniteNumber(eps?.numberOfAnalysts),
                eps7dAgo: toFiniteNumber(trend?.['7daysAgo']),
                eps30dAgo: toFiniteNumber(trend?.['30daysAgo']),
                eps60dAgo: toFiniteNumber(trend?.['60daysAgo']),
                eps90dAgo: toFiniteNumber(trend?.['90daysAgo']),
                up7d: toFiniteNumber(revisions?.upLast7days),
                // Yahoo 원문 키가 이것만 대문자 D다(`downLast7Days`).
                down7d: toFiniteNumber(revisions?.downLast7Days),
                up30d: toFiniteNumber(revisions?.upLast30days),
                down30d: toFiniteNumber(revisions?.downLast30days),
                revenueAvg: toFiniteNumber(revenue?.avg),
                revenueAnalysts: toFiniteNumber(revenue?.numberOfAnalysts),
                revenueGrowth: toFiniteNumber(revenue?.growth),
            },
        ];
    });
}

function firstIso(value: unknown): string | null {
    return Array.isArray(value) ? toIsoOrNull(value[0]) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

function mapTrend(raw: unknown): YahooAnalystTrend | null {
    const rows = asRecord(raw)?.trend;
    if (!Array.isArray(rows)) return null;
    const row = rows
        .map(asRecord)
        .find(r => r !== null && r.period === CURRENT_TREND_PERIOD);
    if (!row) return null;
    return {
        strongBuy: toFiniteNumber(row.strongBuy) ?? 0,
        buy: toFiniteNumber(row.buy) ?? 0,
        hold: toFiniteNumber(row.hold) ?? 0,
        sell: toFiniteNumber(row.sell) ?? 0,
        strongSell: toFiniteNumber(row.strongSell) ?? 0,
    };
}

function mapActions(raw: unknown): YahooRawAnalystAction[] {
    const rows = asRecord(raw)?.history;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(item => {
        const row = asRecord(item);
        if (!row) return [];
        return [
            {
                dateIso: toIsoOrNull(row.epochGradeDate),
                firm: stringOrNull(row.firm),
                fromGrade: stringOrNull(row.fromGrade),
                toGrade: stringOrNull(row.toGrade),
                action: stringOrNull(row.action),
                priceTargetAction: stringOrNull(row.priceTargetAction),
                priorPriceTarget: toFiniteNumber(row.priorPriceTarget),
                currentPriceTarget: toFiniteNumber(row.currentPriceTarget),
            },
        ];
    });
}

/**
 * 최신순으로 정렬한 뒤 최근 90일 행 + 최신 15건의 합집합만 남긴다(둘 다 앞쪽 접두라 합집합은 더 긴 쪽이다).
 * 날짜를 못 읽는 행은 어느 창에도 못 들어가므로 버린다. `now`는 주입한다(테스트 가능성).
 *
 * 날짜를 UTC로 자르는 것은 의도다: 이 값은 거래 세션의 일봉 날짜가 아니라 등급 변경이 발표된 시각이라
 * 거래소 시간대 규칙(SERVER.md#SA-21)의 대상이 아니고, 90일 창의 경계에서 하루 차이는 보존 범위에만 영향을 준다.
 */
export function trimActionsForCache(
    rows: readonly YahooRawAnalystAction[],
    now: Date
): YahooRawAnalystAction[] {
    const cutoff = addUtcIsoDays(toUtcIsoDate(now), -ACTION_CACHE_WINDOW_DAYS);
    return rows
        .filter(
            (row): row is YahooRawAnalystAction & { dateIso: string } =>
                row.dateIso !== null
        )
        .toSorted((a, b) => b.dateIso.localeCompare(a.dateIso))
        .filter(
            (row, index) =>
                index < ACTION_CACHE_MIN_ROWS ||
                toUtcIsoDate(new Date(row.dateIso)) >= cutoff
        );
}

function mapEarnings(raw: unknown): YahooEarningsHint | null {
    const earnings = asRecord(asRecord(raw)?.earnings);
    if (!earnings) return null;
    return {
        dateIso: firstIso(earnings.earningsDate),
        callDateIso: firstIso(earnings.earningsCallDate),
        isEstimate:
            typeof earnings.isEarningsDateEstimate === 'boolean'
                ? earnings.isEarningsDateEstimate
                : null,
    };
}

/**
 * 원 응답 → 캐시 가능한 DTO. 라이브러리 타입이 느슨하고(`validateResult: false`) Redis가 JSON을
 * 거치므로, 날짜는 ISO 문자열로 바꾸고 모든 숫자는 유한성을 검사해 좁힌다.
 */
export function mapAnalystSummary(
    raw: unknown,
    includeActions: boolean,
    now: Date
): YahooAnalystSummary {
    const record = asRecord(raw) ?? {};
    const financial = asRecord(record.financialData);
    return {
        targets: {
            mean: toFiniteNumber(financial?.targetMeanPrice),
            median: toFiniteNumber(financial?.targetMedianPrice),
            low: toFiniteNumber(financial?.targetLowPrice),
            high: toFiniteNumber(financial?.targetHighPrice),
            analysts: toFiniteNumber(financial?.numberOfAnalystOpinions),
        },
        trend: mapTrend(record.recommendationTrend),
        actions: includeActions
            ? trimActionsForCache(
                  mapActions(record.upgradeDowngradeHistory),
                  now
              )
            : null,
        earnings: mapEarnings(record.calendarEvents),
        estimates: mapEstimates(record.earningsTrend),
    };
}

/**
 * Yahoo가 "이 심볼은 서비스할 수 없다"고 영구적으로 답하는 오류 문구. 장애가 아니라 "애널리스트 데이터 없음"이다.
 * 실측·라이브러리 오류 형태: `No fundamentals data found for symbol: SPY`(ETF 등), `Quote not found for ticker
 * symbol: X`(quoteSummary의 `Not Found` 코드는 이름 있는 오류 클래스가 없어 일반 `Error`로 온다),
 * `No data found, symbol may be delisted`(상장폐지). 목록은 의도적으로 작게 두고, 그 밖의 문구는 실패로 남긴다.
 */
const SYMBOL_UNSERVED_MESSAGES: readonly RegExp[] = [
    /No fundamentals data found for symbol/i,
    /Quote not found for (ticker )?symbol/i,
    /No data found, symbol may be delisted/i,
];

/** yahoo-finance2 `HTTPError`가 `code`에 실어 주는 상태. 404만 "심볼 없음"이고 429·5xx는 장애다. */
const HTTP_NOT_FOUND = 404;

export function isSymbolUnservedError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    if (SYMBOL_UNSERVED_MESSAGES.some(re => re.test(error.message)))
        return true;
    return (
        error.name === 'HTTPError' &&
        'code' in error &&
        error.code === HTTP_NOT_FOUND
    );
}

function emptySummary(includeActions: boolean): YahooAnalystSummary {
    return mapAnalystSummary(null, includeActions, new Date());
}

/**
 * Yahoo 애널리스트 요약(목표가·투자의견 분포·증권사별 변경 이력·실적 일정)을 `quoteSummary` 한 번으로 받는다.
 *
 * 실패는 캐시하지 않는다: fetcher가 던지면 `getOrSetCache`가 쓰기를 건너뛰므로, 바깥에서 잡아 로그를 남기고
 * `null`("모름")로 돌린다. 단 "심볼을 서비스할 수 없음" 오류(ETF·미지 심볼·상폐; `isSymbolUnservedError`)는 빈 요약으로 바꿔 **정상 결과처럼 캐시한다** —
 * 그렇지 않으면 ETF 질문마다 Yahoo를 다시 때리고 `degraded`로 오표시된다.
 * `includeActions`가 키에 들어가는 이유는 변경 이력 모듈이 수백 행이라 이력이 필요 없는 호출(한국 종목, 펀더멘털
 * 도구의 가벼운 조회)이 그 비용을 내지 않게 하려는 것이고, 두 변형이 서로의 캐시를 읽지 않게 하기 위해서다.
 * `includeEstimates`(기본 `false`)는 `earningsTrend` 모듈을 더하고 별도 키(`v3:<SYM>:<a|n>e`)를 쓴다 — 추정치가 필요 없는
 * 호출은 기존 v2 키를 그대로 읽어, 추정치 도입이 그 경로의 캐시를 비우거나 응답을 키우지 않는다.
 * E2E fake 모드에서는 네트워크에 나가지 않는다.
 */
export async function getYahooAnalystSummary(
    symbol: string,
    options: { includeActions: boolean; includeEstimates?: boolean }
): Promise<YahooAnalystSummary | null> {
    if (isE2EFakeMode()) return null;
    const { includeActions, includeEstimates = false } = options;
    const yahooSymbol = toYahooSymbol(sym(symbol));
    const modules: QuoteSummaryModules[] = [
        'financialData',
        'recommendationTrend',
        'calendarEvents',
        ...(includeEstimates ? (['earningsTrend'] as const) : []),
        ...(includeActions ? (['upgradeDowngradeHistory'] as const) : []),
    ];
    try {
        return await getOrSetCache<YahooAnalystSummary>(
            // 추정치 변형만 새 키(v3, 접미사 e)를 쓴다 — 추정치가 필요 없는 가벼운 조회는 기존 v2 키를 그대로 읽어
            // 배포 직후 캐시가 한꺼번에 비지 않는다.
            includeEstimates
                ? `yahoo:analyst-summary:v3:${sym(symbol)}:${includeActions ? 'a' : 'n'}e`
                : `yahoo:analyst-summary:v2:${sym(symbol)}:${includeActions ? 'a' : 'n'}`,
            ANALYST_SUMMARY_TTL_SECONDS,
            async () => {
                try {
                    return mapAnalystSummary(
                        await yahooFinance.quoteSummary(
                            yahooSymbol,
                            { modules },
                            { validateResult: false }
                        ),
                        includeActions,
                        new Date()
                    );
                } catch (error) {
                    if (isSymbolUnservedError(error))
                        return emptySummary(includeActions);
                    throw error;
                }
            }
        );
    } catch (error) {
        console.warn(
            '[yahooAnalyst] summary failed',
            yahooSymbol,
            redactDbErrorForLog(error)
        );
        return null;
    }
}
