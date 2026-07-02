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
import { mergeBarsByTime } from './mergeBarsByTime';
import type { SiglensMarketProvider } from './marketProvider.types';

/** 최근(live) 윈도우 시작점: 오늘 − EOD_RECENT_FROM_DAYS일. isLongDailyWindow 게이트에서 사용. */
const EOD_RECENT_FROM_DAYS = 10;

/**
 * EOD history 캐시 만료 시각 = 매일 22:00 KST(=13:00 UTC, 미국 개장 ~30분 전). 그 이후 첫
 * 조회가 전일까지 완료된 EOD를 재조회 → 미국 세션 내내 history fresh, 오늘 봉은 quote가 담당.
 */
const EOD_REFRESH_UTC_HOUR = 13;

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
 * 다음 13:00 UTC(22:00 KST)까지 남은 초를 반환한다. 이미 지났으면 다음 날 13:00 UTC 기준.
 * EOD history 캐시 TTL로 사용해 미국 개장 ~30분 전에 전일까지 EOD를 1회 재조회한다.
 */
export function secondsUntilNextEodRefresh(now: Date): number {
    const target = new Date(now);
    target.setUTCHours(EOD_REFRESH_UTC_HOUR, 0, 0, 0);
    if (target.getTime() <= now.getTime())
        target.setUTCDate(target.getUTCDate() + 1);
    return Math.ceil((target.getTime() - now.getTime()) / 1000);
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
        private readonly inner: SiglensMarketProvider,
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
        // 1Day 라이브 뷰(before 미지정)이면서 lookback이 충분히 긴 경우에만 과거(long)+오늘(live) 분리.
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
     * 1Day 일봉을 불변 과거(history, EOD)와 오늘(today, quote)로 나눠 병렬 fetch 후 병합한다.
     * - history `bars:eodhist:<SYM>`(날짜 없는 앵커 키): `before=어제`로 완료된 EOD만 fetch,
     *   TTL은 매일 22:00 KST(=13:00 UTC)에 만료(secondsUntilNextEodRefresh) → 미국 개장 전
     *   전일까지 EOD 1회 재조회, 세션 내내 fresh. isFresh는 요청 from 커버(truncation 방지)만 판정.
     * - today `bars:today:<SYM>`: `inner.getTodayBar`(quote 기반 OHLCV) 세션 TTL(장중 60s).
     * `mergeBarsByTime`가 오늘 봉을 overlap 우선으로 병합, `sliceFrom`가 options.from으로 잘라
     * 단일 `getBars(from)`와 동일 집합을 만든다. 6h가 아니라 22:00 만료라 daily-refresh 보장 →
     * history는 항상 어제까지 커버, today(quote)와 갭 없음. 앵커 키 전제: 모든 long-1Day 호출부가
     * core 730d lookback 공유(짧은 lookback은 isLongDailyWindow가 단일 경로로 분기).
     */
    private async getCachedDailyBars(options: GetBarsOptions): Promise<Bar[]> {
        const now = new Date();
        const yesterday = isoDateDaysAgo(now, 1);
        const fromThreshold =
            options.from !== undefined
                ? utcMidnightSeconds(options.from)
                : null;
        const symbolKey = options.symbol.toUpperCase();

        const [history, todayBars] = await Promise.all([
            getOrSetCache<Bar[]>(
                `bars:eodhist:${symbolKey}`,
                secondsUntilNextEodRefresh(now),
                () => this.inner.getBars({ ...options, before: yesterday }),
                bars => bars.length > 0,
                bars =>
                    bars.length > 0 &&
                    (fromThreshold === null || bars[0]!.time <= fromThreshold)
            ),
            getOrSetCache<Bar[]>(
                `bars:today:${symbolKey}`,
                this.ttl('1Day'),
                async () => {
                    const bar = await this.inner.getTodayBar(options.symbol);
                    return bar !== null ? [bar] : [];
                },
                bars => bars.length > 0
            ),
        ]);

        return sliceFrom(mergeBarsByTime(history, todayBars), options.from);
    }

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            this.ttl(QUOTE_TTL_TIMEFRAME),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
