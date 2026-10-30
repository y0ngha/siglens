import 'server-only';
import {
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
    type MarketSessionSpec,
    type Timeframe,
    FEAR_GREED_LOOKBACK_DAYS,
    US_EQUITY_SESSION,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { createMemoryLru } from '@/shared/cache/memoryLru';
import {
    EOD_PUBLISH_BUFFER_HOURS,
    lastClosedSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import {
    ISO_DATE_LENGTH,
    MS_PER_SECOND,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import type { EodHistoryEntry } from './eodHistoryMerge';
import { mergeBarsByTime } from './mergeBarsByTime';
import { type EodHistoryDeps, getEodHistory } from './eodHistoryCache';
import {
    EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS,
    HISTORY_MEMORY_MAX_ENTRIES,
    INTRADAY_HISTORY_TTL_SECONDS,
    readCachedHistory,
    type HistoryMemory,
} from './historyCache';
import {
    EXTENDED_HISTORY_MEMORY_MAX_ENTRIES,
    readExtendedBars,
} from './extendedBarsCache';
import { isUsableSnapshot, quoteSnapshotTtlSeconds } from './quoteSnapshotTtl';
import { buildBarsRawKey, buildQuoteSnapshotKey } from './marketCacheKeys';
import { isoDateDaysAgo, sliceFrom, utcMidnightSeconds } from './barsWindow';
import type {
    ExtendedBarsProvider,
    QuoteSnapshot,
    SiglensMarketProvider,
} from './marketProvider.types';

/**
 * `isLongDailyWindow` 라우팅 게이트의 룩백 임계값(일 수).
 * `from`이 이 값보다 오래된 경우 EOD split 경로를 사용하고,
 * 최근 윈도우(오늘−N일 이내)이면 단일 키 경로를 사용한다.
 */
const EOD_LONG_WINDOW_GATE_DAYS = 10;

/**
 * EOD history 키가 덮는 고정 창의 길이(일). 키의 세션 날짜(`lastClosed`)에서 이만큼
 * 거슬러 간 날짜부터 받는다. core의 1Day 호출부 가운데 가장 긴 창(공포·탐욕 5년,
 * `now − FEAR_GREED_LOOKBACK_DAYS`)과 같은 값이라, `lastClosed ≤ 오늘`이므로 모든 호출부의
 * `from`이 이 창 안에 든다. 섹터 스캔(400일)처럼 짧은 창은 받은 값을 잘라 쓴다.
 */
const EOD_HISTORY_WINDOW_DAYS = FEAR_GREED_LOOKBACK_DAYS;

/**
 * 불완전 EOD history(상장폐지/거래정지, 휴장일로 라벨된 세션, 드물게 4h를 초과하는 FMP 지연)를
 * 업스트림 재확인 없이 내주는 쿨다운. 엔트리의 `checkedAt`부터 이 시간이 지나야 다음 요청이
 * 증분 재확인을 하므로 재fetch가 ≈6회/일/심볼로 제한되어 스래싱을 막는다(재확인은 겹침 봉
 * 하나 + 새 봉뿐이라 작다).
 *
 * 4h publish buffer가 대부분의 일시적 FMP 지연을 이미 흡수하므로, "불완전" 조회는 거의 항상
 * 영구적 상황(상장폐지, 거래 없는 휴장일 키)이다. 갭은 발생하지 않는다: today(quote)가
 * 경계를 채우며, 휴장일/주말에는 실제 거래가 없다. 4h를 초과하는 드문 FMP 장애도 다음 쿨다운
 * 재fetch에서 자가 치유된다(다음 세션 이전에 충분히 여유 있음).
 */
const EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS =
    EOD_PUBLISH_BUFFER_HOURS * SECONDS_PER_HOUR;
const EOD_HIST_INCOMPLETE_COOLDOWN_MS =
    EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS * MS_PER_SECOND;

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
 * `MarketDataProvider`를 감싸 getBars/getQuote에 provider 레벨 Redis 캐싱을 주입하는
 * 데코레이터. 분석/차트 경로가 동일 provider를 거치므로(차트 getBarsAction, 분석
 * runAnalysis/runOverallAnalysis), 여기서 캐싱하면 차트·분석·시세 스냅샷(today-quote)·
 * fear&greed 1Day가 같은 캐시를 공유한다 — 분석 결과 cache-miss 시 차트가 워밍한
 * bars를 재사용해 FMP 직격을 막는다. `CachedFundamentalProvider` 패턴과 동형이다.
 *
 * inner.getBars가 FMP 장애로 throw하면 getOrSetCache의 set 전에 전파되어 장애가
 * 캐싱되지 않는다(poison 방지). 빈 봉과 시세·오늘 봉이 둘 다 없는 스냅샷은 shouldCache
 * 가드로 미캐싱해 transient 결과를 TTL 동안 굳히지 않는다(한쪽만 있는 스냅샷은 캐싱한다 —
 * `isUsableSnapshot` 참고). 시세 스냅샷은 장외에도 5분을 넘겨 두지 않는다
 * (`quoteSnapshotTtlSeconds`). Redis 미설정/장애 시 getOrSetCache가
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
export class CachedMarketDataProvider
    implements MarketDataProvider, ExtendedBarsProvider
{
    /**
     * 히스토리 L1. Redis 히스토리 키는 세션이 바뀔 때만 갱신되는데, 장중에는 종목 페이지·섹터
     * 스캔이 그 키(5년 일봉 ~41KB 압축)를 분마다 다시 GET했다. 같은 인스턴스가 이미 들고
     * 있는 값이라 메모리에서 낸다. 일봉은 {@link EodHistoryEntry}, 인트라데이는 `Bar[]`를
     * 담는다 — 한 LRU에 섞어 둬야 인스턴스 힙 상한(`HISTORY_MEMORY_MAX_ENTRIES`)이 하나로 유지된다.
     */
    private readonly historyMemory: HistoryMemory = createMemoryLru<
        Bar[] | EodHistoryEntry
    >(HISTORY_MEMORY_MAX_ENTRIES);

    private readonly extendedHistoryMemory: HistoryMemory = createMemoryLru<
        Bar[] | EodHistoryEntry
    >(EXTENDED_HISTORY_MEMORY_MAX_ENTRIES);

    private readonly eodHistoryDeps: EodHistoryDeps = {
        getBars: options => this.inner.getBars(options),
        memory: this.historyMemory,
    };

    constructor(
        private readonly inner: SiglensMarketProvider &
            Partial<ExtendedBarsProvider>,
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
        return from.slice(0, ISO_DATE_LENGTH) < recentFrom;
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
            options.from.slice(0, ISO_DATE_LENGTH) <
                zonedDate(now, intradayTimeZone)
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
     * - history `bars:eodhist:v3:<SYM>`: 종목당 하나. 요청 `from`과 무관하게
     *   `lastClosed − EOD_HISTORY_WINDOW_DAYS`부터 `before=lastClosed`(완료된 EOD)까지의 고정 창을
     *   담고, 세션이 바뀌면 전체를 다시 받지 않고 **증분 갱신**한다(`getEodHistory`).
     *   `lastClosed`는 `lastClosedSessionDate(this.session, now)`가 세션 스펙에서 유도한다:
     *   - US 주식: 16:00 ET(반장은 13:00) 마감 + EOD_PUBLISH_BUFFER_HOURS(4h) 버퍼 + 주말·NYSE 휴장일 되감기.
     *   - 한국 주식: 15:30 KST 마감 + 같은 버퍼 + 주말·KRX 휴장일 되감기
     *     (`KR_MARKET_HOLIDAYS`; `KR_CALENDAR_HORIZON` 밖 날짜는 정상 개장으로 폴백).
     *   - 크립토(`always-open`): 어제 UTC 날짜 — 24/7이므로 주말 되감기·버퍼 없음.
     *   엔트리가 마지막 마감 봉까지 도달했는지에 따라 유효 기간이 갈린다:
     *   - 도달했으면(newest.time >= lastClosedThreshold) `asOf`가 바뀔 때(다음 세션 롤)까지.
     *   - 미도달이면(FMP EOD 미발행/지연, 상장폐지, 휴장일) `checkedAt`부터 4h 쿨다운
     *     (EOD_HIST_INCOMPLETE_COOLDOWN_SECONDS) 동안만 — 그 뒤 첫 요청이 증분 재확인을 해서
     *     재fetch를 ≈6회/일/심볼로 제한한다. FMP가 따라잡으면 그 재확인에서 새 봉이 붙는다.
     *     갭은 발생하지 않는다: today(quote)가 경계를 채우며 휴장일/주말은 거래가 없다. 단, today(quote)가 lastClosed를 채우는 것은
     *     `lastClosed`가 오늘 당일의 세션 날짜와 같을 때(마감+버퍼 당일)만 해당한다. FMP 발행 지연이
     *     전일 봉에 걸리는 일반 장중 케이스에서는 해당 날짜가 EOD 발행 전까지 진정으로 부재하며,
     *     쿨다운 뒤 재확인이 FMP 발행 후 해소한다. 무조건적인 series 연속성은 보장하지 않는다.
     *   요청 `from`이 고정 창 안이면 엔트리가 창을 덮는지만 본다(창보다 이른 `from`만 `entry.from`으로
     *   커버를 판정한다 — truncation 방지).
     * - today `quote:snapshot:<SYM>`: `inner.getQuoteSnapshot`의 `todayBar`(quote 기반 OHLCV). 세션 TTL(장중 60s)이되
     *   장외에도 5분을 넘기지 않는다(`quoteSnapshotTtlSeconds`).
     *   `getQuote`와 같은 키·같은 업스트림 호출을 공유한다(예전 `bars:today`·`quote:` 이중 키 폐지).
     * `mergeBarsByTime`가 오늘 봉을 overlap 우선으로 병합, `sliceFrom`가 options.from으로 잘라
     * 단일 `getBars(from)`와 동일 집합을 만든다. history는 항상 마지막 마감까지
     * 커버, today(quote)와 갭 없음. 키 전제: long-1Day 호출부의 `from`은
     * 모두 고정 창 안이다(짧은 lookback은 isLongDailyWindow가 단일 경로로 분기).
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
        // 히스토리는 요청 `from`이 아니라 `lastClosed`에서 정해지는 고정 창으로 받는다.
        //
        // 예전에는 요청 `from`으로 받고 "첫 봉 ≤ from"일 때만 캐시 값을 썼다. 그런데 FMP는
        // `from` 이후 첫 **거래일**부터 주므로, `from`이 주말·휴장일이면(core의
        // `now − 1830일`은 매주 화·수요일에 주말이 된다) 첫 봉이 항상 `from`보다 늦고,
        // 상장한 지 5년이 안 된 종목은 매일 그랬다(2026-10 운영 표본 18% — Redis의
        // `bars:eodhist:*` 키를 표본 추출해 첫 봉 날짜가 창 시작보다 늦은 비율로 쟀다). 그때마다
        // 캐시를 무시하고 5년치를 다시 받아 다시 썼다 — FMP 대시보드의 엔드포인트별 Size에서
        // `historical-price-eod/full`이 1위였던 데 이 경로가 크게 기여했다.
        //
        // 이제 엔트리는 자기가 덮는 창 시작(`entry.from`)을 들고 있고 언제나 그 날짜부터 받은
        // 것이므로, 요청 `from`이 창 안이면 첫 봉 날짜와 상관없이 그대로 쓴다(그 앞에 봉이
        // 없다는 뜻일 뿐이다). 창보다 이른 `from`(지금은 호출부가 없다)은 엔트리가 그 `from`을
        // 덮지 못하면 그 `from`으로 다시 받는다.
        const historyFrom = isoDateDaysAgo(
            new Date(utcMidnightSeconds(lastClosed) * MS_PER_SECOND),
            EOD_HISTORY_WINDOW_DAYS
        );
        const requestedFrom = options.from?.slice(0, ISO_DATE_LENGTH);
        const withinWindow =
            requestedFrom === undefined || requestedFrom >= historyFrom;
        const fetchFrom = withinWindow ? historyFrom : requestedFrom;

        const [history, todayBars] = await Promise.all([
            getEodHistory(this.eodHistoryDeps, options, {
                lastClosed,
                lastClosedThreshold,
                fetchFrom,
                nowMs: now.getTime(),
                cooldownMs: EOD_HIST_INCOMPLETE_COOLDOWN_MS,
            }),
            this.getQuoteSnapshot(options.symbol).then(({ todayBar }) =>
                todayBar !== null ? [todayBar] : []
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
     * - history `bars:intrahist:<SYM>:<tf>:<fromDate>:<today>:<limit>` — `before=today`로 받아
     *   `today` 이전 날짜(inner의 타임존 기준) 봉만 남긴다. 날짜가 키에 있어 하루 한 번만 받는다.
     *   FMP의 `to`가 포함/미포함 어느 쪽이어도 같은 결과가 되도록 받은 뒤 날짜로 다시 거른다.
     *   `limit`은 inner에 그대로 넘기므로 `buildBarsRawKey`와 같은 규약으로 키에도 넣는다 —
     *   지금 FMP는 limit을 쓰지 않지만, 결과에 영향을 주게 바뀌어도 서로 다른 limit 요청이
     *   같은 키를 공유하지 않게 한다. 호출부의 limit은 timeframe별 상수라 키가 갈라지지 않는다.
     * - tail `bars:raw:<SYM>:<tf>:<today>::<limit>` — `from=today`(FMP `from`은 포함)로
     *   오늘 봉만, 세션 TTL(장중 60초)로.
     *
     * `today`는 inner가 날짜 인자를 해석하는 타임존의 오늘이다. 두 구간이 같은 날짜 경계를
     * 쓰므로 빈틈도 겹침도 없다(겹치더라도 `mergeBarsByTime`이 tail을 우선한다). `from`은
     * 날짜만 쓴다 — FMP가 원래 날짜로 잘라 쓰므로(`FmpMarketProvider.getBars`) 단일 호출과
     * 같은 봉 집합이다. 이 분기는 `intradayDateTimeZone`을 준 provider(FMP)에서만 켜진다 —
     * 배선은 `getCachedMarketDataProvider`의 `FMP_PROVIDER_OPTIONS`(US·크립토)이고, 크립토가
     * 미 동부 날짜 경계로 나뉘어도 결과가 같은 이유도 그곳에 적었다.
     */
    private async getCachedIntradayBars(
        options: GetBarsOptions & { from: string },
        timeZone: string,
        now: Date
    ): Promise<Bar[]> {
        const today = zonedDate(now, timeZone);
        const fromDate = options.from.slice(0, ISO_DATE_LENGTH);
        const symbolKey = options.symbol.toUpperCase();
        const tailOptions: GetBarsOptions = { ...options, from: today };
        const liveTtl = this.ttl(options.timeframe);

        const [history, tail] = await Promise.all([
            readCachedHistory(
                this.historyMemory,
                `bars:intrahist:${symbolKey}:${options.timeframe}:${fromDate}:${today}:${options.limit ?? ''}`,
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
     * 프리·애프터마켓 인트라데이 봉(**정규장 밖 봉만**) — 표시 전용 계통. 키 계통·TTL·게이트는
     * {@link readExtendedBars} 참고.
     */
    getExtendedBars = (options: GetBarsOptions): Promise<Bar[]> =>
        readExtendedBars(
            {
                timeZone: this.options.intradayDateTimeZone,
                session: this.session,
                fetchExtended: this.inner.getExtendedBars?.bind(this.inner),
                memory: this.extendedHistoryMemory,
            },
            options
        );

    /**
     * `getQuote`와 일봉 오늘 봉이 공유하는 단일 읽기 경로. 두 호출자가 같은 키를 같은
     * `ttl`·`isUsableSnapshot`으로 부르므로 `getOrSetCache`의 in-flight 공유(소유자 인자가
     * 전원에게 적용된다)와 어긋나지 않는다 — 새 호출자를 더하면 이 메서드만 거칠 것.
     * 업스트림에는 첫 호출자의 symbol 표기가 그대로 간다(키만 대문자화).
     */
    private getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot> {
        return getOrSetCache(
            buildQuoteSnapshotKey(symbol),
            quoteSnapshotTtlSeconds(this.ttl(QUOTE_TTL_TIMEFRAME)),
            () => this.inner.getQuoteSnapshot(symbol),
            isUsableSnapshot
        );
    }

    getQuote = async (symbol: string): Promise<MarketQuote | null> =>
        (await this.getQuoteSnapshot(symbol)).quote;
}
