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
import { createMemoryLru, type MemoryLru } from '@/shared/cache/memoryLru';
import {
    EOD_PUBLISH_BUFFER_HOURS,
    lastClosedSessionDate,
    secondsUntilSessionRoll,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import {
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { mergeBarsByTime } from './mergeBarsByTime';
import type { SiglensMarketProvider } from './marketProvider.types';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * `isLongDailyWindow` 라우팅 게이트의 룩백 임계값(일 수).
 * `from`이 이 값보다 오래된 경우 EOD split 경로를 사용하고,
 * 최근 윈도우(오늘−N일 이내)이면 단일 키 경로를 사용한다.
 */
const EOD_LONG_WINDOW_GATE_DAYS = 10;

/**
 * EOD history 캐시 TTL에 더하는 여유. 세션-날짜 키(`bars:eodhist:<SYM>:<date>`)는
 * 다음 세션 마감 + 발행 버퍼에 날짜가 넘어가 다시 읽히지 않으므로, TTL은 "넘어가는
 * 시각까지 남은 시간"(`secondsUntilSessionRoll`)이면 충분하다. 이 여유는 인스턴스 간
 * 시계 차이로 넘어가기 직전에 읽는 요청을 덮는 정도다.
 *
 * 예전에는 7일 고정이었다. 날짜가 넘어간 키가 최대 7일 남아 종목마다 옛 날짜 키가
 * 평균 7개씩 쌓였고(2026-10-04 운영 36,279키·326MB), 반대로 KRX 추석·설 연휴처럼
 * 날짜가 7일 넘게 안 바뀌는 구간에는 키가 먼저 사라져 같은 히스토리를 다시 받았다.
 */
const EOD_HIST_ROLL_MARGIN_SECONDS = SECONDS_PER_HOUR;

/**
 * 불완전 EOD history(상장폐지/거래정지, 휴장일로 라벨된 키, 드물게 4h를 초과하는 FMP 지연)를
 * 캐싱할 쿨다운 TTL. 이 값으로 재fetch를 제한(≈6회/일/심볼)해 스래싱을 방지한다.
 *
 * 4h publish buffer가 대부분의 일시적 FMP 지연을 이미 흡수하므로, "불완전" 조회는 거의 항상
 * 영구적 상황(상장폐지, 거래 없는 휴장일 키)이다. 갭은 발생하지 않는다: today(quote)가
 * 경계를 채우며, 휴장일/주말에는 실제 거래가 없다. 4h를 초과하는 드문 FMP 장애도 다음 쿨다운
 * 재fetch에서 자가 치유된다(다음 세션 이전에 충분히 여유 있음).
 */
const EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS =
    EOD_PUBLISH_BUFFER_HOURS * SECONDS_PER_HOUR;

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return toUtcIsoDate(d);
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
 * 인트라데이 히스토리 키(`bars:intrahist:...:<오늘>`)의 TTL. 키에 "오늘" 날짜가 들어가
 * 날짜가 넘어가면 다시 읽히지 않으므로, TTL은 하루를 넘지 않게 두는 정리용 상한일 뿐이다.
 */
const INTRADAY_HISTORY_TTL_SECONDS = SECONDS_PER_DAY;

/**
 * 비어 있는 인트라데이 오늘 tail의 TTL 상한. 개장 전·주말에는 정상적으로 비지만, 장 마감
 * 뒤 FMP가 일시적으로 빈 배열을 준 것일 수도 있다 — 그 값을 다음 개장까지(최대 24h) 굳히면
 * 오늘 봉이 통째로 사라지므로 길게 두지 않는다. 장중 TTL(60초)보다 길어지는 일은 없다.
 */
const EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS = 15 * SECONDS_PER_MINUTE;

/**
 * 히스토리(`bars:eodhist`·`bars:intrahist`) L1 메모리 상한(provider 인스턴스당).
 *
 * 5년 일봉 히스토리 한 벌이 힙에서 ~110KB(봉 ~1,360개)다. 128개면 ~14MB이고, provider
 * 싱글톤이 세션별로 셋(US·크립토·KR)이라 최악 ~42MB다. 섹터 스캔(미국 ~80종목)과
 * 종목 페이지의 뜨거운 종목을 함께 덮는 크기다.
 */
const HISTORY_MEMORY_MAX_ENTRIES = 128;

/**
 * 히스토리 L1의 TTL 상한. 완성된 히스토리는 세션 날짜 키 안에서 바뀌지 않지만, 미완성
 * (FMP 발행 지연 → 쿨다운 TTL) 값은 Redis 쪽이 먼저 갱신될 수 있다. 메모리 쪽이 그보다
 * 오래 낡은 값을 쥐지 않도록 30분마다 Redis를 다시 본다 — 그 비용은 키당 GET 한 번이다.
 */
const HISTORY_MEMORY_TTL_CAP_SECONDS = 30 * SECONDS_PER_MINUTE;

/** 생성 옵션 — 세션과 별개로 inner provider의 특성을 기술한다. */
export interface CachedMarketDataProviderOptions {
    /**
     * inner provider가 인트라데이 `from`/`before` 날짜를 해석하는 타임존(FMP는
     * `America/New_York`). 지정하면 인트라데이 라이브 뷰를 "어제까지의 히스토리(하루 1회)
     * + 오늘 tail(장중 60초)"로 나눠 캐시한다. 지정하지 않으면(Yahoo 등 날짜 의미가 다른
     * provider) 예전처럼 전체 창을 단일 키로 캐시한다.
     */
    intradayDateTimeZone?: string;
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
 * runAnalysis/runOverallAnalysis), 여기서 캐싱하면 차트·분석·today-quote·
 * fear&greed 1Day가 같은 캐시를 공유한다 — 분석 결과 cache-miss 시 차트가 워밍한
 * bars를 재사용해 FMP 직격을 막는다. `CachedFundamentalProvider` 패턴과 동형이다.
 *
 * inner.getBars가 FMP 장애로 throw하면 getOrSetCache의 set 전에 전파되어 장애가
 * 캐싱되지 않는다(poison 방지). 빈 봉/ null quote는 shouldCache 가드로 미캐싱해
 * transient 결과를 TTL 동안 굳히지 않는다. Redis 미설정/장애 시 getOrSetCache가
 * graceful fallback(inner 직접 호출)한다.
 *
 * market summary 경로는 이 데코레이터를 쓰지 않는다(getMarketDataProvider raw 사용 —
 * market-isr 전담). sector signals는 일봉(및 FMP scope의 인트라데이) 스캔에 이 데코레이터를
 * 쓴다(`sectorSignalsProviderFor`). 적용은 getCachedMarketDataProvider 팩토리가 담당.
 *
 * `session`은 core의 `MarketSessionSpec`으로 시장 세션 특성(개폐장 시간, 24/7 여부)을
 * 기술한다. `computeBarsEffectiveTtl`이 세션을 참고해 적절한 Redis TTL을 결정한다.
 * crypto는 `CRYPTO_SESSION`(always-open), us-equity는 `US_EQUITY_SESSION`(ET 정규장).
 */
export class CachedMarketDataProvider implements MarketDataProvider {
    /**
     * 히스토리 L1. Redis 히스토리 키는 세션 날짜로만 바뀌는데, 장중에는 종목 페이지·섹터
     * 스캔이 그 키(5년 일봉 ~41KB 압축)를 분마다 다시 GET했다. 같은 인스턴스가 이미 들고
     * 있는 값이라 메모리에서 낸다.
     */
    private readonly historyMemory: MemoryLru<Bar[]> = createMemoryLru<Bar[]>(
        HISTORY_MEMORY_MAX_ENTRIES
    );

    constructor(
        private readonly inner: SiglensMarketProvider,
        private readonly session: MarketSessionSpec = US_EQUITY_SESSION,
        private readonly options: CachedMarketDataProviderOptions = {}
    ) {}

    private ttl(timeframe: Timeframe): number {
        return computeBarsEffectiveTtl(timeframe, new Date(), this.session);
    }

    /**
     * `from`이 최근 윈도우(오늘−EOD_LONG_WINDOW_GATE_DAYS) 이전인지 확인한다.
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
        // 짧은 lookback(from이 최근 ~EOD_LONG_WINDOW_GATE_DAYS일 이내)은 과거 윈도우가 역전되므로 단일 경로 사용.
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
        const intradayTimeZone = this.options.intradayDateTimeZone;
        if (
            intradayTimeZone !== undefined &&
            options.timeframe !== '1Day' &&
            options.before === undefined &&
            options.from !== undefined &&
            options.from.slice(0, 10) < zonedDate(now, intradayTimeZone)
        ) {
            return this.getCachedIntradayBars(
                { ...options, from: options.from },
                intradayTimeZone,
                now
            );
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
     *   `lastClosed`는 `lastClosedSessionDate(this.session, now)`가 세션 스펙에서 유도한다:
     *   - US 주식: 16:00 ET(반장은 13:00) 마감 + EOD_PUBLISH_BUFFER_HOURS(4h) 버퍼 + 주말·NYSE 휴장일 되감기.
     *   - 한국 주식: 15:30 KST 마감 + 같은 버퍼 + 주말·KRX 휴장일 되감기
     *     (`KR_MARKET_HOLIDAYS`; `KR_CALENDAR_HORIZON` 밖 날짜는 정상 개장으로 폴백).
     *   - 크립토(`always-open`): 어제 UTC 날짜 — 24/7이므로 주말 되감기·버퍼 없음.
     *   TTL은 fetch된 bars가 lastClosed까지 도달했는지에 따라 분기한다:
     *   - 도달했으면(newest.time >= lastClosedThreshold) 다음 세션 롤까지 + 여유(EOD_HIST_ROLL_MARGIN_SECONDS).
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
        // 세션 스펙이 시장 차이를 흡수한다: 크립토는 어제 UTC, 미국은 16:00 ET 마감 +
        // 4h 버퍼 + 주말·NYSE 휴장일 되감기, 한국은 15:30 KST 마감 + 주말·KRX 휴장일 되감기.
        // **`this.session`을 넘기는 것이 핵심** — ET 고정 헬퍼를 쓰면 추수감사절처럼
        // NYSE만 쉬는 날 KRX 봉이 `before=lastClosed`에 잘려 나간다.
        const lastClosed = lastClosedSessionDate(this.session, now);
        const lastClosedThreshold = utcMidnightSeconds(lastClosed);
        const fromThreshold =
            options.from !== undefined
                ? utcMidnightSeconds(options.from)
                : null;
        const symbolKey = options.symbol.toUpperCase();
        // 이 키가 다시 읽히지 않게 되는 시각(다음 세션 마감 + 발행 버퍼)까지만 둔다.
        const rollTtlSeconds =
            secondsUntilSessionRoll(this.session, now) +
            EOD_HIST_ROLL_MARGIN_SECONDS;

        const [history, todayBars] = await Promise.all([
            this.getHistory(
                `bars:eodhist:${symbolKey}:${lastClosed}`,
                bars =>
                    bars.length > 0 &&
                    bars[bars.length - 1]!.time >= lastClosedThreshold
                        ? rollTtlSeconds
                        : Math.min(
                              EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS,
                              rollTtlSeconds
                          ),
                () => this.inner.getBars({ ...options, before: lastClosed }),
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

        // 확정된 EOD 봉은 quote 파생 봉이 덮어쓰지 못한다 — quote 봉은 **EOD 히스토리의
        // 마지막 봉보다 엄격히 뒤**일 때만 live tail로 붙인다. 옛 구현은 같은 날짜에서
        // quote 봉이 이겼는데, 마감 뒤·휴장 직후 Yahoo quote는 open/high/low=0 이거나
        // 지연된 시각의 값을 줘 확정 EOD 봉(2026-10-02 373220.KS)을 0봉으로 갈아치웠다.
        // 기준을 `lastClosedThreshold`가 아니라 히스토리 실제 마지막 봉으로 잡는 이유:
        // FMP 발행 지연으로 히스토리가 lastClosed까지 못 채워졌을 때(쿨다운 TTL 경로)
        // quote 봉이 그 빈 날을 메워야 하기 때문이다. 히스토리가 비면 quote 봉을 그대로 쓴다.
        const lastHistoryTime = history.at(-1)?.time;
        const liveTail =
            lastHistoryTime === undefined
                ? todayBars
                : todayBars.filter(b => b.time > lastHistoryTime);
        return sliceFrom(mergeBarsByTime(history, liveTail), options.from);
    }

    /**
     * 인트라데이 라이브 뷰를 어제까지의 히스토리와 오늘 tail로 나눠 가져와 병합한다.
     *
     * 예전에는 `bars:raw:*` 단일 키(장중 60초)라 활성 (종목, timeframe)마다 **매분 FMP
     * `historical-chart` 전체 창**(5Min 10일 ≈ 780봉, 1Hour 60일 등)을 다시 받아 다시
     * SET했다. 지난 날짜의 봉은 바뀌지 않으므로:
     * - history `bars:intrahist:<SYM>:<tf>:<fromDate>:<today>` — `before=today`로 받아
     *   `today` 이전 날짜(inner의 타임존 기준) 봉만 남긴다. 날짜가 키에 있어 하루 한 번만 받는다.
     *   FMP의 `to`가 포함/미포함 어느 쪽이어도 같은 결과가 되도록 받은 뒤 날짜로 다시 거른다.
     * - tail `bars:raw:<SYM>:<tf>:<today>::<limit>` — `from=today`(FMP `from`은 포함)로
     *   오늘 봉만, 세션 TTL(장중 60초)로.
     *
     * `today`는 inner가 날짜 인자를 해석하는 타임존의 오늘이다. 두 구간이 같은 날짜 경계를
     * 쓰므로 빈틈도 겹침도 없다(겹치더라도 `mergeBarsByTime`이 tail을 우선한다). `from`은
     * 날짜만 쓴다 — FMP가 원래 날짜로 잘라 쓰므로(`FmpMarketProvider.getBars`) 단일 호출과
     * 같은 봉 집합이다. 이 분기는 `intradayDateTimeZone`을 준 provider(FMP)에서만 켜진다.
     */
    private async getCachedIntradayBars(
        options: GetBarsOptions & { from: string },
        timeZone: string,
        now: Date
    ): Promise<Bar[]> {
        const today = zonedDate(now, timeZone);
        const fromDate = options.from.slice(0, 10);
        const symbolKey = options.symbol.toUpperCase();
        const tailOptions: GetBarsOptions = { ...options, from: today };
        const liveTtl = this.ttl(options.timeframe);

        const [history, tail] = await Promise.all([
            this.getHistory(
                `bars:intrahist:${symbolKey}:${options.timeframe}:${fromDate}:${today}`,
                () => INTRADAY_HISTORY_TTL_SECONDS,
                async () =>
                    (
                        await this.inner.getBars({
                            ...options,
                            from: fromDate,
                            before: today,
                        })
                    ).filter(
                        b =>
                            zonedDate(
                                new Date(b.time * MS_PER_SECOND),
                                timeZone
                            ) < today
                    ),
                bars => bars.length > 0
            ),
            getOrSetCache<Bar[]>(
                buildBarsRawKey(tailOptions),
                bars =>
                    bars.length > 0
                        ? liveTtl
                        : Math.min(
                              liveTtl,
                              EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS
                          ),
                () => this.inner.getBars(tailOptions)
            ),
        ]);
        return mergeBarsByTime(history, tail);
    }

    /**
     * 히스토리 키 읽기: L1 메모리 → `getOrSetCache`(Redis + in-flight dedup) 순. 빈 결과는
     * 어느 쪽에도 두지 않는다. `isFresh`는 L1 hit에도 똑같이 적용한다 — 넓은 기준으로 저장된
     * 값만 좁은 요청을 덮는다(`getOrSetCache`의 isFresh 규약과 같다).
     */
    private async getHistory(
        key: string,
        ttlSeconds: (bars: Bar[]) => number,
        fetcher: () => Promise<Bar[]>,
        isFresh: (bars: Bar[]) => boolean
    ): Promise<Bar[]> {
        const memo = this.historyMemory.get(key);
        if (memo !== undefined && isFresh(memo)) return memo;
        const bars = await getOrSetCache<Bar[]>(
            key,
            ttlSeconds,
            fetcher,
            fetched => fetched.length > 0,
            isFresh
        );
        if (bars.length > 0 && isFresh(bars)) {
            this.historyMemory.set(
                key,
                bars,
                Math.min(ttlSeconds(bars), HISTORY_MEMORY_TTL_CAP_SECONDS) *
                    MS_PER_SECOND
            );
        }
        return bars;
    }

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            this.ttl(QUOTE_TTL_TIMEFRAME),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
