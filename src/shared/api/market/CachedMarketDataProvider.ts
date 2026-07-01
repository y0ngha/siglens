import 'server-only';
import {
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
    type MarketSessionSpec,
    type Timeframe,
    US_EQUITY_SESSION,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { mergeBarsByTime } from './mergeBarsByTime';

/**
 * 과거(불변) 윈도우 종료점: 오늘 − EOD_HIST_TO_DAYS일. recent와 겹쳐 갭 방지.
 * overlap = EOD_RECENT_FROM_DAYS − EOD_HIST_TO_DAYS = 5일 →
 * 최대 4일 연속 휴장(공휴일+주말 인접)에도 겹침이 유지된다.
 */
const EOD_HIST_TO_DAYS = 5;
/** 최근(live) 윈도우 시작점: 오늘 − EOD_RECENT_FROM_DAYS일. */
const EOD_RECENT_FROM_DAYS = 10;
/** 과거 history long TTL(30일). 갱신은 TTL이 아니라 recent와의 겹침 staleness가 주도. */
const EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 30;
/** stale(겹침 소실) history를 재조회하는 최소 간격. 상장폐지·장기정지처럼 최신 봉이
 * 영구히 recentFrom에 못 미치는 심볼이 매 요청마다 full 재fetch하는 것을 방지한다. */
const EOD_HIST_STALE_RECHECK_SECONDS = SECONDS_PER_HOUR;

/** history 캐시 엔트리: 불변 과거 봉 + fetch 시각(stale-recheck 쿨다운 판정용). */
interface EodHistoryEntry {
    bars: Bar[];
    fetchedAt: number; // unix seconds
}

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD(또는 ISO) 날짜를 UTC 자정 unix초로 변환(Bar.time과 동일 규약). */
function utcMidnightSeconds(dateStr: string): number {
    return Math.floor(Date.parse(dateStr.slice(0, 10) + 'T00:00:00Z') / 1000);
}

/** `from` 이후(포함) 봉만 남긴다 — 단일 `getBars(from)`와 동일 집합 보장. */
function sliceFrom(bars: Bar[], from: string | undefined): Bar[] {
    if (from === undefined) return bars;
    const threshold = utcMidnightSeconds(from);
    return bars.filter(b => b.time >= threshold);
}

/**
 * history 캐시 엔트리가 재사용 가능한지 판정한다:
 * ① covers: 캐시된 최古 봉이 요청 `fromThreshold`를 커버(더 과거 요청 시 truncation 방지),
 * ② overlap: 최신 봉이 recent 윈도우와 겹치면 fresh,
 * ③ cooldown: 겹침이 소실됐어도(상장폐지 등 permanent-stale) 최근 재조회했으면 재사용해
 *    per-request 재fetch thrash를 막는다.
 */
function isHistoryEntryFresh(
    entry: EodHistoryEntry,
    fromThreshold: number | null,
    recentFromThreshold: number,
    nowSeconds: number
): boolean {
    if (entry.bars.length === 0) return false;
    const covers =
        fromThreshold === null || entry.bars[0]!.time <= fromThreshold;
    if (!covers) return false;
    if (entry.bars[entry.bars.length - 1]!.time >= recentFromThreshold)
        return true;
    return nowSeconds - entry.fetchedAt < EOD_HIST_STALE_RECHECK_SECONDS;
}

/** quote TTL은 bars 일봉 개장-경계 정책을 재사용 — timeframe과 무관한 placeholder. */
const QUOTE_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 캐시 키는 결과에 영향을 줄 수 있는 `GetBarsOptions` 필드를 모두 포함한다 —
 * symbol/timeframe/from/before에 더해 limit까지. 현재 FmpMarketProvider는 limit을
 * URL에 쓰지 않지만, 캐시를 거치는 호출부(fetchBarsWithIndicators)는 limit을
 * timeframe별 상수(TIMEFRAME_BARS_LIMIT)로 고정하므로 limit은 timeframe에 종속이다 →
 * 키에 포함해도 캐시 분할이 생기지 않으면서, 향후 옵션이 결과에 영향을 주도록 바뀌어도
 * 키 충돌(서로 다른 요청이 같은 캐시 반환)을 방지한다. `GetBarsOptions`에 결과-영향
 * 필드가 추가되면 이 키도 함께 갱신할 것.
 */
function buildBarsRawKey(o: GetBarsOptions): string {
    return `bars:raw:${o.symbol.toUpperCase()}:${o.timeframe}:${o.from ?? ''}:${o.before ?? ''}:${o.limit ?? ''}`;
}

/**
 * `MarketDataProvider`를 감싸 getBars/getQuote에 provider 레벨 Redis 캐싱을 주입하는
 * 데코레이터. 분석/차트 경로가 동일 provider를 거치므로(차트 getBarsAction, 분석
 * submitAnalysis/submitOverallAnalysis), 여기서 캐싱하면 차트·분석·today-quote·
 * fear&greed 1Day가 같은 캐시를 공유한다 — 분석 결과 cache-miss 시 차트가 워밍한
 * bars를 재사용해 FMP 직격을 막는다. `CachedFundamentalProvider` 패턴과 동형이다.
 *
 * inner.getBars가 FMP 장애로 throw하면 getOrSetCache의 set 전에 전파되어 장애가
 * 캐싱되지 않는다(poison 방지). 빈 봉/ null quote는 shouldCache 가드로 미캐싱해
 * transient 결과를 TTL 동안 굳히지 않는다. Redis 미설정/장애 시 getOrSetCache가
 * graceful fallback(inner 직접 호출)한다.
 *
 * market summary/sector signals 경로는 이 데코레이터를 쓰지 않는다(getMarketDataProvider
 * raw 사용 — market-isr 전담). 적용은 getCachedMarketDataProvider 팩토리가 담당.
 *
 * `session`은 core의 `MarketSessionSpec`으로 시장 세션 특성(개폐장 시간, 24/7 여부)을
 * 기술한다. `computeBarsEffectiveTtl`이 세션을 참고해 적절한 Redis TTL을 결정한다.
 * crypto는 `CRYPTO_SESSION`(always-open), us-equity는 `US_EQUITY_SESSION`(ET 정규장).
 */
export class CachedMarketDataProvider implements MarketDataProvider {
    constructor(
        private readonly inner: MarketDataProvider,
        private readonly session: MarketSessionSpec = US_EQUITY_SESSION
    ) {}

    private ttl(timeframe: Timeframe): number {
        return computeBarsEffectiveTtl(timeframe, new Date(), this.session);
    }

    /**
     * `from`이 최근 윈도우(오늘−EOD_RECENT_FROM_DAYS) 이전인지 확인한다.
     * `from===undefined`이면 전체 히스토리 요청이므로 항상 split을 적용한다.
     * `from`이 최근 윈도우 안에 있으면(짧은 lookback), 과거 윈도우가 역전되므로
     * single-key 경로를 사용한다.
     */
    private isLongDailyWindow(from: string | undefined): boolean {
        // from===undefined ⇒ full history ⇒ split. Otherwise only split when the
        // requested start is older than the recent window; a short lookback (from
        // within the last ~EOD_RECENT_FROM_DAYS days) would invert the historical window, so it uses the
        // single-key path instead.
        if (from === undefined) return true;
        const recentFrom = isoDateDaysAgo(new Date(), EOD_RECENT_FROM_DAYS);
        return from.slice(0, 10) < recentFrom;
    }

    getBars = (options: GetBarsOptions): Promise<Bar[]> => {
        // 1Day 라이브 뷰(before 미지정)이면서 lookback이 충분히 긴 경우에만 과거(long)+최근(live) 분리.
        // 짧은 lookback(from이 최근 ~EOD_RECENT_FROM_DAYS일 이내)은 과거 윈도우가 역전되므로 단일 경로 사용.
        // 인트라데이·과거 페이지네이션(before 지정)도 기존 단일 60s 경로 유지.
        if (
            options.timeframe === '1Day' &&
            options.before === undefined &&
            this.isLongDailyWindow(options.from)
        ) {
            return this.getCachedDailyBars(options);
        }
        return getOrSetCache(
            buildBarsRawKey(options),
            this.ttl(options.timeframe),
            () => this.inner.getBars(options),
            bars => bars.length > 0
        );
    };

    /**
     * 요청 윈도우가 최근 overlap 구간보다 앞에서 시작함을 전제로 한다(isLongDailyWindow
     * 가드 통과 후 진입). 짧은 lookback은 getBars를 통해 단일 경로로 라우팅된다.
     *
     * 1Day 일봉을 불변 과거(history, 날짜-없는 앵커 키 `bars:eodhist:<SYM>`)와 최근(live,
     * `bars:eodrecent:<SYM>`)으로 나눠 병렬 fetch 후 병합한다. 캐시 키에 날짜를 넣지 않아
     * UTC 자정 롤로 인한 전체 재fetch가 없다.
     *
     * history 엔트리는 `{ bars, fetchedAt }` 형태로 저장한다. `isFresh` 판정:
     *   1. covers(from): 캐시된 최古 봉이 요청 `from` 이전이어야 함 — 짧은 캐시가 긴 요청을
     *      잘라내는 truncation을 방지한다.
     *   2. 겹침 유지: 최신 봉이 recentFrom 이후 → fresh.
     *   3. stale-recheck 쿨다운: 겹침이 소실됐어도(상장폐지·장기정지 등 permanent-stale) 최근
     *      EOD_HIST_STALE_RECHECK_SECONDS 이내 fetch했으면 그대로 사용 — 매 요청마다 full
     *      재fetch thrash를 막는다. 쿨다운 만료 후에만 재fetch.
     *
     * recent는 `from=오늘−EOD_RECENT_FROM_DAYS`(오늘 봉을 quote로 append)를 세션 TTL로 가져와
     * 오늘/최근 신선도를 담당한다. 두 윈도우의 (EOD_RECENT_FROM_DAYS − EOD_HIST_TO_DAYS)일
     * 겹침을 `mergeBarsByTime`가 recent 우선으로 dedup하고, `sliceFrom`가 options.from으로
     * 잘라 단일 `getBars(from)`와 동일 집합을 만든다.
     *
     * 앵커 키에서 from을 뺄 수 있는 근거: 모든 long-1Day 호출부가 core
     * TIMEFRAME_LOOKBACK_DAYS['1Day'] 단일 lookback을 공유한다(짧은 lookback은 가드가
     * 단일 경로로 분기). core lookback 변경 시 이 전제도 함께 갱신할 것.
     */
    private async getCachedDailyBars(options: GetBarsOptions): Promise<Bar[]> {
        const now = new Date();
        const nowSeconds = Math.floor(now.getTime() / 1000);
        const histTo = isoDateDaysAgo(now, EOD_HIST_TO_DAYS);
        const recentFrom = isoDateDaysAgo(now, EOD_RECENT_FROM_DAYS);
        const recentFromThreshold = utcMidnightSeconds(recentFrom);
        const fromThreshold =
            options.from !== undefined
                ? utcMidnightSeconds(options.from)
                : null;
        const symbolKey = options.symbol.toUpperCase();

        const [historyEntry, recent] = await Promise.all([
            getOrSetCache<EodHistoryEntry>(
                `bars:eodhist:${symbolKey}`,
                EOD_HIST_TTL_SECONDS,
                async () => ({
                    bars: await this.inner.getBars({
                        ...options,
                        before: histTo,
                    }),
                    fetchedAt: nowSeconds,
                }),
                entry => entry.bars.length > 0,
                entry =>
                    isHistoryEntryFresh(
                        entry,
                        fromThreshold,
                        recentFromThreshold,
                        nowSeconds
                    )
            ),
            getOrSetCache(
                `bars:eodrecent:${symbolKey}`,
                this.ttl('1Day'),
                () => this.inner.getBars({ ...options, from: recentFrom }),
                bars => bars.length > 0
            ),
        ]);

        return sliceFrom(
            mergeBarsByTime(historyEntry.bars, recent),
            options.from
        );
    }

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            this.ttl(QUOTE_TTL_TIMEFRAME),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
