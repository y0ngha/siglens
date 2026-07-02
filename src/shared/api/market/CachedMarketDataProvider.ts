import 'server-only';
import {
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
    type MarketSessionSpec,
    type Timeframe,
    MARKET_CLOSE_HOUR,
    US_EQUITY_SESSION,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
import {
    MS_PER_HOUR,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import { mergeBarsByTime } from './mergeBarsByTime';
import type { SiglensMarketProvider } from './marketProvider.types';

/**
 * `isLongDailyWindow` 라우팅 게이트의 룩백 임계값(일 수).
 * `from`이 이 값보다 오래된 경우 EOD split 경로를 사용하고,
 * 최근 윈도우(오늘−N일 이내)이면 단일 키 경로를 사용한다.
 */
const EOD_LONG_WINDOW_GATE_DAYS = 10;

/** 마감(16:00 ET) 후 FMP EOD 발행까지의 안전 버퍼(시간). 이 시간 전에는 당일을
 * lastClosed로 롤하지 않아, 발행 전 불완전 EOD가 당일 키에 캐시되는 것을 막는다.
 * 버퍼 구간에도 당일 봉은 quote(최종 OHLCV)로 온전히 표시된다. */
const EOD_PUBLISH_BUFFER_HOURS = 4;

/**
 * EOD history 캐시 TTL. 세션-날짜 키(bars:eodhist:<SYM>:<date>)가 미국 마감마다
 * 자동 롤(자연 버전닝)되므로 TTL은 단순히 롱 홀리데이 플래토를 넘길 여유만 있으면 된다.
 * 7일 = 공휴일 연속 최대치(추수감사절 주 등)를 충분히 커버.
 */
const EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 7;

/**
 * 불완전 EOD history(상장폐지/거래정지, 휴장일로 라벨된 키, 드물게 4h를 초과하는 FMP 지연)를
 * 캐싱할 쿨다운 TTL. 이 값으로 재fetch를 제한(≈6회/일/심볼)해 스래싱을 방지한다.
 *
 * 4h publish buffer가 대부분의 일시적 FMP 지연을 이미 흡수하므로, "불완전" 조회는 거의 항상
 * 영구적 상황(상장폐지, 거래 없는 휴장일 키)이다. 갭은 발생하지 않는다: today(quote)가
 * 경계를 채우며, 휴장일/주말에는 실제 거래가 없다. 4h를 초과하는 드문 FMP 장애도 다음 쿨다운
 * 재fetch에서 자가 치유된다(다음 세션 이전에 충분히 여유 있음).
 */
const EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS = SECONDS_PER_HOUR * 4;

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
 * 마지막으로 마감된(16:00 ET 경과) 미국 정규 세션의 ET 날짜(YYYY-MM-DD)를 반환한다.
 * 서머타임은 getEasternOffsetHours로 반영(여름 마감=20:00 UTC, 겨울=21:00 UTC). 주말은
 * 직전 금요일로 되감는다(공휴일은 미보정 — 그 날짜로 키가 한 번 더 versioning될 뿐 EOD
 * 조회는 실제 마지막 거래일까지 반환하므로 데이터는 정확). EOD history 캐시 키에 넣어
 * 미국 마감마다 캐시가 자연 롤(=세션당 1회 재조회)되게 한다.
 *
 * EOD_PUBLISH_BUFFER_HOURS: 마감 직후 FMP가 당일 EOD를 아직 발행하지 않았을 수 있으므로,
 * 16:00 ET + 4h(20:00 ET)가 지나야 당일을 lastClosed로 롤한다. 버퍼 구간에는 직전 거래일이
 * lastClosed로 유지되어, 불완전 EOD가 당일 키에 캐시되는 갭을 방지한다.
 */
export function lastClosedSessionDateEt(now: Date): string {
    const et = new Date(
        now.getTime() + getEasternOffsetHours(now) * MS_PER_HOUR
    );
    const dow = et.getUTCDay(); // 0=Sun..6=Sat (ET wall-clock via shifted UTC getters)
    const closedToday =
        1 <= dow &&
        dow <= 5 &&
        et.getUTCHours() >= MARKET_CLOSE_HOUR + EOD_PUBLISH_BUFFER_HOURS;
    const cursor = new Date(
        Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate())
    );
    if (!closedToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let day = cursor.getUTCDay();
    while (day === 0 || day === 6) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        day = cursor.getUTCDay();
    }
    return cursor.toISOString().slice(0, 10);
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
     *
     * `now`는 `getBars`에서 캡처한 단일 클락 값을 전달받아, 한 번의 `getBars` 호출이
     * 동일 시각 기준으로 동작하도록 보장한다.
     */
    private isLongDailyWindow(
        from: string | undefined,
        now: Date = new Date()
    ): boolean {
        // from===undefined ⇒ full history ⇒ split. Otherwise only split when the
        // requested start is older than the gate threshold; a short lookback (from
        // within the last ~EOD_LONG_WINDOW_GATE_DAYS days) would invert the historical window, so it uses the
        // single-key path instead.
        if (from === undefined) return true;
        const recentFrom = isoDateDaysAgo(now, EOD_LONG_WINDOW_GATE_DAYS);
        return from.slice(0, 10) < recentFrom;
    }

    getBars = (options: GetBarsOptions): Promise<Bar[]> => {
        // 1Day 라이브 뷰(before 미지정)이면서 lookback이 충분히 긴 경우에만 과거(long)+오늘(live) 분리.
        // 짧은 lookback(from이 최근 ~EOD_RECENT_FROM_DAYS일 이내)은 과거 윈도우가 역전되므로 단일 경로 사용.
        // 인트라데이·과거 페이지네이션(before 지정)도 기존 단일 60s 경로 유지.
        // now를 한 번만 캡처해 isLongDailyWindow와 getCachedDailyBars가 동일 클락 기준으로 동작.
        const now = new Date();
        if (
            options.timeframe === '1Day' &&
            options.before === undefined &&
            this.isLongDailyWindow(options.from, now)
        ) {
            return this.getCachedDailyBars(options, now);
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
     * - history `bars:eodhist:<SYM>:<lastClosed>`: 세션-날짜 키가 세션 마감마다 자동 롤 →
     *   세션당 1회 재조회. `before=lastClosed`로 완료된 EOD까지만 fetch.
     *   `lastClosed`는 세션 종류에 따라 다르게 계산된다:
     *   - US 주식(`non-always-open` / US equity): 16:00 ET 마감 + EOD_PUBLISH_BUFFER_HOURS(4h) 버퍼 + 주말 되감기.
     *   - 크립토(`always-open`): 어제 UTC 날짜 — 24/7이므로 주말 되감기·ET 버퍼 없음.
     *   TTL은 fetch된 bars가 lastClosed까지 도달했는지에 따라 분기한다:
     *   - 도달했으면(newest.time >= lastClosedThreshold) 7일 long TTL(EOD_HIST_TTL_SECONDS).
     *   - 미도달이면(FMP EOD 미발행/지연, 상장폐지, 휴장일 키) 4h 쿨다운 TTL(EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS)로
     *     재fetch를 제한(≈6회/일/심볼)한다. FMP가 따라잡으면 long TTL로 승격된다.
     *     갭은 발생하지 않는다: today(quote)가 경계를 채우며 휴장일/주말은 거래가 없다. 단, today(quote)가 lastClosed를 채우는 것은
     *     `lastClosed`가 오늘 당일의 세션 날짜와 같을 때(마감+버퍼 당일)만 해당한다. FMP 발행 지연이
     *     전일 봉에 걸리는 일반 장중 케이스에서는 해당 날짜가 EOD 발행 전까지 진정으로 부재하며,
     *     short TTL 재시도가 FMP 발행 후 해소한다. 무조건적인 series 연속성은 보장하지 않는다.
     *   isFresh는 요청 from 커버(truncation 방지)만 판정.
     * - today `bars:today:<SYM>`: `inner.getTodayBar`(quote 기반 OHLCV) 세션 TTL(장중 60s).
     * `mergeBarsByTime`가 오늘 봉을 overlap 우선으로 병합, `sliceFrom`가 options.from으로 잘라
     * 단일 `getBars(from)`와 동일 집합을 만든다. 세션-날짜 키로 history는 항상 마지막 마감까지
     * 커버, today(quote)와 갭 없음. 키 전제: 모든 long-1Day 호출부가 core 730d lookback 공유
     * (짧은 lookback은 isLongDailyWindow가 단일 경로로 분기).
     *
     * `now`는 `getBars`에서 캡처한 단일 클락 값을 받아, 한 번의 호출 안에서 `isLongDailyWindow`와
     * 동일 시각 기준으로 동작하도록 보장한다.
     */
    private async getCachedDailyBars(
        options: GetBarsOptions,
        now: Date = new Date()
    ): Promise<Bar[]> {
        // 24/7 크립토: 주말도 거래일 → 어제 UTC가 마지막 완료 일봉.
        // US 주식: 16:00 ET 마감 + 4h 버퍼 + 주말 되감기.
        const lastClosed =
            this.session.kind === 'always-open'
                ? isoDateDaysAgo(now, 1)
                : lastClosedSessionDateEt(now);
        const lastClosedThreshold = utcMidnightSeconds(lastClosed);
        const fromThreshold =
            options.from !== undefined
                ? utcMidnightSeconds(options.from)
                : null;
        const symbolKey = options.symbol.toUpperCase();

        const [history, todayBars] = await Promise.all([
            getOrSetCache<Bar[]>(
                `bars:eodhist:${symbolKey}:${lastClosed}`,
                bars =>
                    bars.length > 0 &&
                    bars[bars.length - 1]!.time >= lastClosedThreshold
                        ? EOD_HIST_TTL_SECONDS
                        : EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS,
                () => this.inner.getBars({ ...options, before: lastClosed }),
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

        // quote-derived today bar wins on same-time overlap (intended: live tail takes
        // precedence over any same-dated EOD history bar). Note: a stale pre-market
        // /quote timestamp could momentarily overwrite an authoritative EOD bar with
        // quote-approximated OHLCV until a fresh trade updates the quote; self-heals.
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
