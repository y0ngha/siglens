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
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { mergeBarsByTime } from './mergeBarsByTime';

/** 과거(불변) 윈도우 종료점: 오늘 − 7일. 최근 윈도우와 겹쳐 주말·공휴일 갭 방지. */
const EOD_HIST_TO_DAYS = 7;
/** 최근(live) 윈도우 시작점: 오늘 − 10일(약 3일 overlap → dedup). */
const EOD_RECENT_FROM_DAYS = 10;
/** 과거 윈도우 long TTL. 키가 날짜로 self-versioning하므로 intraday 커버 + 여유. */
const EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 2;

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
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
     * 요청 윈도우가 최근 overlap 구간(오늘−EOD_RECENT_FROM_DAYS)보다 앞에서 시작함을
     * 전제로 한다(isLongDailyWindow 가드 통과 후 진입). 짧은 lookback은 getCachedDailyBars를
     * 직접 호출하지 말고 반드시 getBars를 통해 라우팅할 것.
     *
     * 1Day 일봉을 불변 과거(long-cache)와 최근(live)로 나눠 fetch 후 병합한다.
     * 과거 윈도우는 `before=오늘−EOD_HIST_TO_DAYS`로 한정해 오늘 봉을 포함하지 않으므로(=불변)
     * long TTL로 캐싱하고, 매일 키(`from`·`histTo` 날짜)가 self-versioning된다.
     * 최근 윈도우(`from=오늘−EOD_RECENT_FROM_DAYS`)는 작은 EOD(~EOD_RECENT_FROM_DAYS행)+오늘 봉(quote)을 기존 세션 TTL
     * (장중 60s)로 가져온다. 두 윈도우는 (EOD_RECENT_FROM_DAYS - EOD_HIST_TO_DAYS)일 겹쳐 주말·공휴일 갭을 막고
     * `mergeBarsByTime`가 중복(time)을 최근 우선으로 제거한다. 결과는 단일
     * `getBars(from)`와 동일 집합이다.
     */
    private async getCachedDailyBars(options: GetBarsOptions): Promise<Bar[]> {
        const now = new Date();
        const histTo = isoDateDaysAgo(now, EOD_HIST_TO_DAYS);
        const recentFrom = isoDateDaysAgo(now, EOD_RECENT_FROM_DAYS);
        const symbolKey = options.symbol.toUpperCase();
        const [historical, recent] = await Promise.all([
            getOrSetCache(
                `bars:eodhist:${symbolKey}:${options.from ?? ''}:${histTo}`,
                EOD_HIST_TTL_SECONDS,
                () => this.inner.getBars({ ...options, before: histTo }),
                bars => bars.length > 0
            ),
            getOrSetCache(
                `bars:eodrecent:${symbolKey}:${recentFrom}`,
                this.ttl('1Day'),
                () => this.inner.getBars({ ...options, from: recentFrom }),
                bars => bars.length > 0
            ),
        ]);
        return mergeBarsByTime(historical, recent);
    }

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            this.ttl(QUOTE_TTL_TIMEFRAME),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
