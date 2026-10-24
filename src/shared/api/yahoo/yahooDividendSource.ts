import 'server-only';
import { getYahooClient } from './createYahooClient';
import { getYahooFundamentals } from './yahooFundamentalSource';
import { sym } from '@/shared/api/fmp/symKey';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
    MS_PER_DAY,
} from '@/shared/config/time';

const yahooFinance = getYahooClient();

/**
 * 배당 이력 조회 창. 트레일링 12개월 + "직전 배당" 탐색에 충분한 3년이다. 월봉(`1mo`)으로 받는 이유:
 * 배당 이벤트 날짜는 interval과 무관한데(실측 032640.KS: 일봉·월봉 모두 같은 ex-date) 일봉은 3년치
 * 시세 행을 불필요하게 싣는다.
 */
const HISTORY_LOOKBACK_DAYS = 3 * 366;

/** yahoo chart `events=div` 한 건. 날짜는 배당락일(`YYYY-MM-DD`)이고 금액은 상장 통화(KRW) 주당이다. */
export interface YahooDividendEvent {
    exDate: string;
    amount: number;
}

/**
 * 한국 종목 배당 원자료. `history`가 1순위(트레일링 합을 직접 계산할 수 있다)이고, `summary`는
 * 이력을 못 받았을 때만 쓰는 2순위다 — 실측상 KRX 종목은 `summaryDetail`의 trailingAnnual* 필드가
 * 비어 있는 경우가 많다(032640.KS·088980.KS). `history: null`은 조회 실패, `[]`는 이벤트 없음이다.
 */
export interface YahooDividendData {
    history: YahooDividendEvent[] | null;
    summary: YahooDividendSummary | null;
}

/**
 * yahoo `summaryDetail`/`defaultKeyStatistics`에서 꺼낸 배당 필드. 수익률은 yahoo 원값(소수, 0.018 = 1.8%)이다.
 * 날짜는 Redis(JSON) 왕복을 견디도록 ISO 문자열로 바꿔 둔다.
 */
export interface YahooDividendSummary {
    /** 연 배당률(주당, 현재 공시 기준). */
    dividendRate: number | null;
    /** 최근 12개월 주당 배당 합. */
    trailingAnnualDividendRate: number | null;
    dividendYield: number | null;
    trailingAnnualDividendYield: number | null;
    /** 직전 배당락일(`YYYY-MM-DD`). */
    exDividendDate: string | null;
    /** 마지막 1회 배당금(주당). */
    lastDividendValue: number | null;
    /** 마지막 배당 일자(`YYYY-MM-DD`). */
    lastDividendDate: string | null;
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 실측(2026-10-24, 032640.KS·033780.KS): chart 배당 이벤트 `date`는 UTC 자정 `Date`(예: epoch 1786492800 =
 * 2026-08-12T00:00:00Z = 서울 날짜 2026-08-12)라 UTC로 잘라도 KST 날짜와 같다 — 시간대 보정이 필요 없다.
 * yahoo는 날짜를 `Date`(또는 캐시를 거친 ISO 문자열·epoch 초)로 준다. 해석이 안 되면 null. */
function toIsoDateOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date =
        value instanceof Date
            ? value
            : new Date(
                  typeof value === 'number' ? value * 1000 : String(value)
              );
    return Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 10)
        : null;
}

/**
 * chart `events=div`로 배당 이력을 읽는다(최신 배당락일 순). 실패는 삼키고 `null`(이력 모름)이다 —
 * 호출부가 `summaryDetail`로 degrade하고, 이 결과는 캐시하지 않는다.
 */
async function fetchDividendHistory(
    symbol: string
): Promise<YahooDividendEvent[] | null> {
    try {
        const result = await yahooFinance.chart(
            symbol,
            {
                period1: new Date(
                    Date.now() - HISTORY_LOOKBACK_DAYS * MS_PER_DAY
                ),
                period2: new Date(),
                interval: '1mo',
                events: 'div',
            },
            { validateResult: false }
        );
        // Safe cast: 라이브러리 반환 유니온이 interval마다 달라 `events`가 구조적으로 좁혀지지 않는다.
        // 모든 필드를 unknown으로 받아 아래에서 검사하므로 형상이 달라도 런타임에서 흡수된다.
        const raw = (
            result as unknown as {
                events?: { dividends?: { date?: unknown; amount?: unknown }[] };
            }
        ).events?.dividends;
        return (raw ?? [])
            .map(item => ({
                exDate: toIsoDateOrNull(item?.date),
                amount: numberOrNull(item?.amount),
            }))
            .filter(
                (event): event is YahooDividendEvent =>
                    event.exDate !== null && event.amount !== null
            )
            .toSorted((a, b) => b.exDate.localeCompare(a.exDate));
    } catch (error) {
        // 부분 degrade(요약으로 대체)라 호출부에는 에러로 전달되지 않는다 — 이 지점이 유일한 로그다.
        console.warn('[yahooDividend] history failed', symbol, error);
        return null;
    }
}

function summaryFrom(
    summary: NonNullable<
        Awaited<ReturnType<typeof getYahooFundamentals>>['summary']
    >
): YahooDividendSummary {
    const detail = summary.summaryDetail;
    const stats = summary.defaultKeyStatistics;
    return {
        dividendRate: numberOrNull(detail?.dividendRate),
        trailingAnnualDividendRate: numberOrNull(
            detail?.trailingAnnualDividendRate
        ),
        dividendYield: numberOrNull(detail?.dividendYield),
        trailingAnnualDividendYield: numberOrNull(
            detail?.trailingAnnualDividendYield
        ),
        exDividendDate: toIsoDateOrNull(detail?.exDividendDate),
        lastDividendValue: numberOrNull(stats?.lastDividendValue),
        lastDividendDate: toIsoDateOrNull(stats?.lastDividendDate),
    };
}

/**
 * 한국 종목의 배당 원자료(이력 + 요약). 둘 다 못 얻으면 throw한다 — 로그는 호출부(`fetchDividendSource`)가
 * 한 번만 남기고 "모름"(`null`)으로 degrade한다.
 *
 * 키 `dividends:yahoo:v2:<SYM>` — 24h. `v2`는 값 형상이 요약 단독에서 `{history, summary}`로 바뀐 표시다
 * (옛 키를 새 형상으로 읽는 것을 막는다).
 *
 * 캐시 규칙(`shouldCache`): **이력이 확정됐을 때만**(`history !== null`) 캐시한다. 이력 조회가 실패해 요약만
 * 있는 결과는 캐시하지 않아, 일시 장애가 하루 동안 "트레일링 모름"으로 굳지 않는다. 반대로 이력이 확정(`[]`
 * 포함)이면 요약 조회가 실패해 `summary: null`이어도 그대로 24h 캐시한다 — 그 경우 이력이 비어 있으면
 * "모름"이 하루 유지된다. 이력도 요약도 못 얻으면 fetcher가 throw해 캐시 쓰기를 건너뛴다.
 */
export async function getYahooDividendData(
    symbol: string
): Promise<YahooDividendData> {
    const upper = sym(symbol);
    return getOrSetCache<YahooDividendData>(
        `dividends:yahoo:v2:${upper}`,
        FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
        async () => {
            const [history, fundamentals] = await Promise.all([
                fetchDividendHistory(upper),
                getYahooFundamentals(upper),
            ]);
            const summary =
                fundamentals.summary === null
                    ? null
                    : summaryFrom(fundamentals.summary);
            if (history === null && summary === null)
                throw new Error('yahoo dividend data missing');
            return { history, summary };
        },
        value => value.history !== null
    );
}
