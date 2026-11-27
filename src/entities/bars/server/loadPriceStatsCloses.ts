import 'server-only';
import {
    FEAR_GREED_LOOKBACK_DAYS,
    closeOnOrBefore,
    type AgentHistoryIndex,
    type MarketDailyClose,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { INDEX_SOURCES } from '@/entities/index-history/lib/indexSources';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    MS_PER_MINUTE,
    MS_PER_SECOND,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import {
    __resetSingleFlightForTests,
    createSingleFlight,
} from '@/shared/lib/singleFlight';
import { hasFormingBar, lastBarIsForming } from '../lib/quantizeBars';
import { getCachedBarsWithIndicators } from './barsDataCache';
import {
    loadDailyCloseHistory,
    type DailyHistorySource,
} from './loadDailyCloseHistory';

/** 종가가 어디서 왔는가: 이미 뜨거운 5년 일봉 캐시, 또는 전체 이력(1970년부터). */
export type PriceStatsSource = 'five_year_cache' | 'full_history';

export interface PriceStatsCloses {
    /** 마감된 세션의 종가(가격 기준, 배당 제외), 거래소 현지 날짜 오름차순. 비어 있지 않다. */
    closes: MarketDailyClose[];
    source: PriceStatsSource;
    /** 지금 정규 세션이 진행 중이라 그 봉을 뺐는가(24시간 시장은 늘 진행 중이라 `false` — 코어가 따로 알린다). */
    sessionInProgress: boolean;
}

/**
 * 전체 이력 메모의 항목 수. 항목 하나가 일봉 약 1.4만 행(미국 상장 50년 이상)이라 수십만 바이트 — 8개면 수 MB다.
 * Redis에는 두지 않는다(결과 캐시는 임의의 날짜 인자라 거의 적중하지 않고, 이력은 한 번 더 직렬화하기엔 크다). 이 메모는
 * "그럼 20년은?" 같은 같은 종목의 연속 질문과 한 턴 안의 반복 호출을 받는다.
 */
const FULL_HISTORY_MEMO_ENTRIES = 8;
/**
 * 마지막 행이 마지막 마감 세션이면(새 종가가 이미 실렸다) 1시간: 키에 그 세션 날짜가 들어 새 종가가 확정되면 키가 바뀌고, TTL은
 * FMP가 그 세션 행을 늦게 고친 경우의 상한이다.
 */
const FULL_HISTORY_MEMO_TTL_MS = SECONDS_PER_HOUR * MS_PER_SECOND;
/**
 * 마지막 행이 마지막 마감 세션에 못 미치면(공급자가 아직 그 세션을 싣지 않았다) 짧게 둔다 — 한 시간 동안 한 세션 뒤처진 이력을
 * 붙들지 않는다.
 */
const FULL_HISTORY_STALE_MEMO_TTL_MS = 5 * MS_PER_MINUTE;
/**
 * 이 도구의 전체 이력 로드가 프로세스 전체에서 동시에 도는 수의 상한(SERVER.md#CC-1·CC-10). 로드 하나가 미국은 FMP 구간 6개를
 * 한 번에 보내므로 이 상한이 이 도구가 내는 동시 FMP 요청 수(최대 2 × 6)를 묶는다. **이 도구의 로드만** 센다 — 스윙 이력
 * (`get_swing_history`)과 지수 월말 이력(`loadIndexMonthEnds`)은 이 한도기를 거치지 않으므로 FMP 전체 트래픽의 상한은 아니다.
 * 한 호출의 주체 수(core `AGENT_PRICE_STATS_MAX_SUBJECTS`)와 동시 대화가 겹쳐도 같다. 빈 슬롯이 있으면 바로 돌고, 없으면 먼저
 * 온 순서(FIFO)로 슬롯이 나기를 기다린다.
 */
export const FULL_HISTORY_CONCURRENCY = 2;
/**
 * 슬롯을 기다리는 최대 시간. 넘으면 그 주체는 읽지 못한 것으로 던져(`FullHistoryBusyError`) 실행기가 `provider_failed`로 돌려준다 — 같은
 * 호출의 다른 주체가 core 도구 시간 상한(`TOOL_TIMEOUT_MS.cached`, 30초) 안에 돌아와야 해서, 대기가 로드 시간(최대 10초)과
 * 합쳐져도 넘치지 않는 값이다.
 */
export const FULL_HISTORY_WAIT_DEADLINE_MS = 8_000;
/** 알 수 없는 종목(자산 조회 실패 + 캐시 비어 있음)의 "이력 없음"을 기억하는 시간. 같은 오타를 거듭 물어도 FMP를 다시 치지 않는다. */
const UNKNOWN_SYMBOL_MEMO_TTL_MS = 5 * MS_PER_MINUTE;
const UNKNOWN_SYMBOL_MEMO_ENTRIES = 64;
/** 지수 종가를 반올림하는 자릿수(2자리)의 배수. */
const PRICE_DECIMALS_FACTOR = 100;
/** 이음매 검사: 전체 이력의 마지막 행과 캐시의 같은 날짜 행의 종가가 이 비율 안이어야 같은 기준(분할 보정 등)으로 본다. */
const SEAM_CLOSE_TOLERANCE = 1e-3;

export class FullHistoryBusyError extends Error {
    constructor() {
        super('full history loads are busy');
        this.name = 'FullHistoryBusyError';
    }
}

/** 5년 일봉 캐시(`fearGreedBars`)의 폭(일). `bars`만 있으면 그 폭이 730일이다. */
const BARS_WINDOW_DAYS = 730;
/** 시리즈 첫 날짜가 창 시작보다 이만큼 넘게 늦어야 "창이 아니라 상장일에서 시작했다"고 본다(연초 휴장·공급자 경계 여유). */
const WINDOW_START_SLACK_DAYS = 45;

const fullHistoryMemo = createMemoryLru<MarketDailyClose[]>(
    FULL_HISTORY_MEMO_ENTRIES
);
const fullHistoryInFlight = createSingleFlight<MarketDailyClose[]>();
const unknownSymbolMemo = createMemoryLru<true>(UNKNOWN_SYMBOL_MEMO_ENTRIES);

interface Waiter {
    grant: () => void;
}
/** 한도기 상태: 도는 로드 수와 슬롯을 기다리는 순서(FIFO). `let` 없이 쓰려고 객체 속성을 바꾼다. */
const limiter: { active: number; queue: readonly Waiter[] } = {
    active: 0,
    queue: [],
};

function acquireSlot(): Promise<void> {
    if (limiter.active < FULL_HISTORY_CONCURRENCY) {
        limiter.active += 1;
        return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
        // 마감 콜백은 데드라인 뒤에야 돌아 그때는 `waiter`가 이미 있다.
        const timer = setTimeout(() => {
            limiter.queue = limiter.queue.filter(w => w !== waiter);
            reject(new FullHistoryBusyError());
        }, FULL_HISTORY_WAIT_DEADLINE_MS);
        const waiter: Waiter = {
            grant: () => {
                clearTimeout(timer);
                resolve();
            },
        };
        limiter.queue = [...limiter.queue, waiter];
    });
}

/** 슬롯을 놓는다: 기다리는 로드가 있으면 슬롯을 그 로드에 그대로 넘기고(도는 수는 그대로), 없으면 도는 수를 줄인다. */
function releaseSlot(): void {
    const next = limiter.queue[0];
    if (next === undefined) {
        limiter.active -= 1;
        return;
    }
    limiter.queue = limiter.queue.slice(1);
    next.grant();
}

async function limited<T>(work: () => Promise<T>): Promise<T> {
    await acquireSlot();
    try {
        return await work();
    } finally {
        releaseSlot();
    }
}

const usable = (close: MarketDailyClose): boolean =>
    Number.isFinite(close.close) && close.close > 0;

/**
 * 진행 중인 세션이 있어 뺐다고 알릴 때: 24시간 시장은 "세션 진행 중"이 아니라 일봉 정의 문제라 코어의 별도 안내를 쓴다.
 */
function sessionInProgressOf(session: MarketSessionSpec, now: Date): boolean {
    return session.kind !== 'always-open' && hasFormingBar(session, now);
}

interface CachedSeries {
    closes: MarketDailyClose[];
    windowDays: number;
}

/**
 * 5년 일봉 캐시(`getCachedBarsWithIndicators`가 이미 들고 있는 `fearGreedBars`)에서 **완결된** 일봉의 종가를 뽑는다. 빼는 것은
 * 형성 중인 마지막 봉(정규장 중의 오늘 봉)뿐이다 — 마감은 했지만 EOD 게시 여유 안인 세션의 봉은 남긴다. 그 봉이
 * `get_bars_indicators`의 `calendarChange`·`show_chart` 비교가 끝나는 날짜라, 도구마다 끝 날짜가 갈리지 않는다.
 *
 * 쓸 수 없는 종가(유한하지 않거나 0 이하)는 여기서 거른다. 전체 이력 경로도 같은 규칙으로 거르므로 날짜 하나가 두 경로에서 같게
 * 읽힌다. 한계: 거른 날짜는 core가 `unusable_price`가 아니라 "세션 없음"으로 읽는다.
 */
async function loadFiveYearCloses(input: {
    symbol: string;
    fmpSymbol?: string;
    session: MarketSessionSpec;
    now: Date;
}): Promise<CachedSeries> {
    const data = await getCachedBarsWithIndicators(
        getCachedMarketDataProvider(input.session),
        input.symbol,
        '1Day',
        input.fmpSymbol,
        input.session
    );
    const series = data.fearGreedBars ?? data.bars;
    const completed = lastBarIsForming(series, input.session, input.now)
        ? series.slice(0, -1)
        : series;
    return {
        closes: completed
            .map(bar => ({
                date: toUtcIsoDate(new Date(bar.time * MS_PER_SECOND)),
                close: bar.close,
            }))
            .filter(usable),
        windowDays:
            data.fearGreedBars === undefined
                ? BARS_WINDOW_DAYS
                : FEAR_GREED_LOOKBACK_DAYS,
    };
}

/**
 * 시리즈가 창 시작이 아니라 상장일에서 시작했는가 — 그러면 캐시가 그 종목의 이력 전체다.
 *
 * 자산 조회(`AssetInfo`)는 상장일·첫 거래일을 주지 않아 날짜 비교 휴리스틱을 쓴다: 첫 날짜가 창 시작보다
 * `WINDOW_START_SLACK_DAYS`(45일) 넘게 늦으면 상장일에서 시작한 것으로 본다. 한계: 창 시작을 가로지르는 45일 넘는 거래 정지가
 * 있던 오래된 종목은 정지 뒤 첫 날짜가 이 기준을 넘어 이력 전체로 잘못 읽힌다(그 종목의 `max`·긴 기간은 캐시 이전 구간이 빠진다).
 * 상장일을 주는 출처가 생기면 이 검사를 그 날짜로 막는다.
 */
function startsAtListing(series: CachedSeries, lastClosed: string): boolean {
    const first = series.closes.at(0);
    return (
        first !== undefined &&
        first.date >
            addUtcIsoDays(
                lastClosed,
                -(series.windowDays - WINDOW_START_SLACK_DAYS)
            )
    );
}

/**
 * 전체 이력을 메모(8개)와 전역 동시 실행 상한을 거쳐 읽는다. 같은 키의 동시 호출은 한 번의 로드로 접히고, 실패는 저장하지 않으며,
 * 빈 이력도 저장하지 않는다(상장 직후 같은 일시적 빈 응답을 굳히지 않는다). 쓸 수 없는 종가는 거른다.
 */
function loadFullHistory(input: {
    source: DailyHistorySource;
    providerSymbol: string;
    session: MarketSessionSpec;
    now: Date;
    lastClosed: string;
}): Promise<MarketDailyClose[]> {
    const key = `${input.source}:${input.providerSymbol}:${input.lastClosed}`;
    const hit = fullHistoryMemo.get(key);
    if (hit !== undefined) return Promise.resolve(hit);
    return fullHistoryInFlight.run(key, () =>
        limited(async () => {
            const closes = (
                await loadDailyCloseHistory({
                    symbol: input.providerSymbol,
                    source: input.source,
                    session: input.session,
                    now: input.now,
                })
            ).filter(usable);
            if (closes.length > 0)
                fullHistoryMemo.set(
                    key,
                    closes,
                    closes.at(-1)?.date === input.lastClosed
                        ? FULL_HISTORY_MEMO_TTL_MS
                        : FULL_HISTORY_STALE_MEMO_TTL_MS
                );
            return closes;
        })
    );
}

/**
 * 한 종목의 완결된 일봉 종가(가격 기준, 배당 제외)를 요청이 필요로 하는 만큼만 읽는다.
 *
 * 5년 일봉 캐시를 먼저 읽는다 — 사용자가 본 종목이면 이미 뜨겁다. 다음 중 하나면 그 시리즈를 쓰고 새 요청은 없다:
 * (1) `earliestFor(마지막 종가 날짜)`가 돌려준 날짜(core `priceStatsEarliestDate`)에 닿는 종가가 있다, (2) 시리즈가 캐시 창이
 * 아니라 상장일에서 시작한다(5년이 안 된 종목은 캐시가 이력 전체다). 그 밖에 — `earliestFor`가 `null`(`max`)이거나 시리즈가 모자라거나
 * 캐시를 못 읽었거나 비었으면 — 전체 이력으로 간다. 필요 날짜는 **이 시리즈의 실제 마지막 종가**를 기준으로 구한다 — 그 종가가
 * `computePriceStats`가 창을 재는 기준과 같아야 둘이 어긋나지 않는다.
 *
 * 끝 날짜: 전체 이력은 마지막 마감 세션까지만 오므로(`loadDailyCloseHistory`), 캐시가 이미 읽은 완결 행 중 그 뒤 날짜를 붙인다.
 * 마감은 했지만 EOD 게시 여유 안인 세션이 두 경로에서 같은 날짜로 끝난다. 붙이는 것은 캐시에 전체 이력의 마지막 날짜 행이 있고 종가가
 * 같을 때(같은 기준일 때)뿐이다.
 *
 * 알 수 없는 종목(`assetKnown` false + 캐시 비어 있음)은 전체 이력을 읽지 않고 `null`이며 5분간 기억한다.
 *
 * `null`은 이력 없음이다. 전체 이력 공급자 실패는 던진다(캐시 읽기 실패는 전체 이력으로 넘어가고 이름만 남긴다).
 */
export async function loadPriceStatsCloses(input: {
    symbol: string;
    fmpSymbol?: string;
    profile: MarketProfileId;
    session: MarketSessionSpec;
    /** 자산 조회가 이 심볼을 알아봤는가. 못 알아봤고 캐시도 비었으면 전체 이력을 치지 않는다(알 수 없는 종목). */
    assetKnown: boolean;
    earliestFor: (lastCloseDate: string) => string | null;
    now: Date;
}): Promise<PriceStatsCloses | null> {
    const lastClosed = lastClosedSessionDate(input.session, input.now);
    const sessionInProgress = sessionInProgressOf(input.session, input.now);
    const unknownKey = `${input.profile}:${input.fmpSymbol ?? input.symbol}`;
    if (unknownSymbolMemo.get(unknownKey) !== undefined) return null;
    // 읽기 실패는 빈 시리즈와 구별한다(`cacheReadFailed`): 실패는 "그 종목에 이력이 없다"는 증거가 아니다.
    const cacheRead = await loadFiveYearCloses(input).then(
        (series): { series: CachedSeries; cacheReadFailed: boolean } => ({
            series,
            cacheReadFailed: false,
        }),
        (error: unknown) => {
            console.warn(
                '[priceStats] five-year cache read failed, using full history',
                { errorName: error instanceof Error ? error.name : 'unknown' }
            );
            return {
                series: { closes: [], windowDays: FEAR_GREED_LOOKBACK_DAYS },
                cacheReadFailed: true,
            };
        }
    );
    const cached = cacheRead.series;
    const last = cached.closes.at(-1);
    if (last !== undefined) {
        const earliest = input.earliestFor(last.date);
        const reaches =
            earliest !== null && closeOnOrBefore(cached.closes, earliest) >= 0;
        if (reaches || startsAtListing(cached, lastClosed))
            return {
                closes: cached.closes,
                source: 'five_year_cache',
                sessionInProgress,
            };
    }
    // 알 수 없는 종목: 자산 조회가 못 알아봤고 5년 캐시를 **성공적으로 읽었는데** 비었다 — 6개 구간 요청을 보내지 않고 잠시
    // 기억한다. 캐시 읽기가 실패했으면 이 판정을 하지 않고 전체 이력으로 넘어간다(기억도 하지 않는다).
    if (last === undefined && !input.assetKnown && !cacheRead.cacheReadFailed) {
        unknownSymbolMemo.set(unknownKey, true, UNKNOWN_SYMBOL_MEMO_TTL_MS);
        return null;
    }
    const full = await loadFullHistory({
        source: input.profile === 'kr-equity' ? 'yahoo' : 'fmp',
        providerSymbol: input.fmpSymbol ?? input.symbol,
        session: input.session,
        now: input.now,
        lastClosed,
    });
    const lastFull = full.at(-1);
    if (lastFull === undefined) return null;
    // 꼬리는 두 시리즈가 이음매 날짜에서 같은 종가일 때만 붙인다 — 다르면 기준이 다른 것(분할 보정 시점 차이 등)이라 이어 붙이지 않는다.
    const seam = cached.closes.find(close => close.date === lastFull.date);
    const sameBasis =
        seam !== undefined &&
        Math.abs(seam.close - lastFull.close) <=
            Math.abs(lastFull.close) * SEAM_CLOSE_TOLERANCE;
    const tail = sameBasis
        ? cached.closes.filter(close => close.date > lastFull.date)
        : [];
    return {
        closes: tail.length === 0 ? full : [...full, ...tail],
        source: 'full_history',
        sessionInProgress,
    };
}

/**
 * 주가 지수(`AGENT_HISTORY_INDICES`) 자체의 마감된 일봉 종가. 지수는 5년 일봉 캐시에 없어 항상 전체 이력 경로다(미국 지수는
 * FMP `light`, 한국 지수는 Yahoo). `null`은 이력 없음, 공급자 실패는 던진다.
 */
export async function loadIndexPriceStatsCloses(
    index: AgentHistoryIndex,
    now: Date
): Promise<PriceStatsCloses | null> {
    const source = INDEX_SOURCES[index];
    const session = sessionSpecFor(source.profile);
    const closes = await loadFullHistory({
        source: source.provider,
        providerSymbol: source.symbol,
        session,
        now,
        lastClosed: lastClosedSessionDate(session, now),
    });
    return closes.length === 0
        ? null
        : {
              // Yahoo index closes are long floats (4214.169921875). Round once here so the figures, summaries and date closes
              // core derives all print the same 2-decimal level. Stock and crypto closes already come rounded from FMP.
              // New objects: the memoized history is shared and never mutated.
              closes: closes.map(close => ({
                  date: close.date,
                  close:
                      Math.round(close.close * PRICE_DECIMALS_FACTOR) /
                      PRICE_DECIMALS_FACTOR,
              })),
              source: 'full_history',
              sessionInProgress: sessionInProgressOf(session, now),
          };
}

/** 테스트 전용 — 전체 이력 메모와 in-flight 맵을 비운다. */
export function __resetFullHistoryMemoForTests(): void {
    __resetMemoryLruForTests(fullHistoryMemo);
    __resetSingleFlightForTests(fullHistoryInFlight);
    __resetMemoryLruForTests(unknownSymbolMemo);
    limiter.active = 0;
    limiter.queue = [];
}
