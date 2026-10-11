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
import { createMemoryLru, type MemoryLru } from '@/shared/cache/memoryLru';
import {
    EOD_PUBLISH_BUFFER_HOURS,
    lastClosedSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import {
    ISO_DATE_LENGTH,
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import {
    type EodHistoryEntry,
    type EodServeContext,
    canExtendIncrementally,
    isEntryServable,
    mergeIncremental,
    overlapStatus,
    trimToWindow,
} from './eodHistoryMerge';
import { mergeBarsByTime } from './mergeBarsByTime';
import type {
    QuoteSnapshot,
    SiglensMarketProvider,
} from './marketProvider.types';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

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
 * EOD history 키 접두사. 종목당 키 하나(`bars:eodhist:v3:<SYM>`)에 {@link EodHistoryEntry}를
 * 담는다. `v2`(세션 날짜가 키에 든 `Bar[]`)와 값 모양이 달라 접두사를 올렸다 — 같은 키를
 * 재사용하면 배포 직후 옛 엔트리를 새 모양으로 잘못 읽는다. 옛 키는 읽는 코드가 없어 각자의
 * TTL로 저절로 사라진다. 올리는 비용은 종목당 전체 창을 한 번 더 받는 것(평소의 세션 롤 한 번)과
 * 같지만, 전 종목이 같은 시점에 겹치므로 배포 직후 FMP 호출이 한꺼번에 몰린다.
 *
 * ## 증분 갱신 (2026-10)
 *
 * 예전에는 키가 세션 날짜(`lastClosed`)별이라 세션이 넘어갈 때마다 활성 종목 전부가 5년치
 * (~1,260봉, 압축 ~41KB)를 FMP `historical-price-eod/full`에서 통째로 다시 받았다 — 엔드포인트별
 * 바이트 1위였다. 이제 세션이 바뀌면 **마지막 캐시 봉의 날짜부터** 겹쳐 받아 새 봉만 이어 붙인다
 * (`getEodHistory`). 키가 세션과 무관하니 종목당 한 벌만 남는다 — 날짜별 사본이 쌓이지 않는다
 * (날짜 키를 7일 TTL로 쌓아 두던 시절 326MB — 2026-10-04 운영). 보관 기간은 아래 TTL 참고.
 */
const EOD_HISTORY_KEY_PREFIX = 'bars:eodhist:v3';

/**
 * EOD history 엔트리의 Redis TTL. 이제 세션 롤이 아니라 엔트리 안의 `asOf`가 유효성을 정하므로
 * TTL은 "오래 안 보는 종목을 치우는" 정리용 상한이다. 엔트리가 사라져도 정확성은 그대로이고
 * (다음 요청이 전체 창을 한 번 받는다) 증분의 이득만 잃는다. 쓸 때마다 갱신된다.
 *
 * 5일은 저장량과 증분 이득의 절충이다. 매일 조회되는 종목은 쓸 때마다 갱신돼 사라지지 않는다.
 * 고정 TTL은 쓴 시각부터 세므로, 금요일 저녁(~20:00 ET)에 쓴 엔트리는 월요일이 휴장인 연휴 뒤
 * 화요일 롤(~4일 뒤)까지 살아 있어야 한다 — 4일이면 그 직전에 만료돼 시장 전체가 한꺼번에
 * 전체 창을 받는다. 5일은 일반 주말(금→월 롤)과 월·금요일 휴장 연휴(사흘 연휴)를 덮는다.
 * 덮지 못하는 것은 그보다 긴 휴장(KRX 추석 등)으로, 그 뒤에는 종목당 한 번 전체 창을 받는다
 * (예전과 같은 비용). 그보다 길게 안 보이는 롱테일 종목까지 붙들면 그 수만큼 5년치 봉이
 * Redis에 남는다(종목당 ~41KB) — 예전 날짜 키는 롤 + 1시간이면 사라졌다.
 */
const EOD_HISTORY_TTL_SECONDS = 5 * SECONDS_PER_DAY;

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

function isoDateDaysAgo(now: Date, days: number): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return toUtcIsoDate(d);
}

/** YYYY-MM-DD(또는 ISO) 날짜를 UTC 자정 unix초로 변환(Bar.time과 동일 규약). */
function utcMidnightSeconds(dateStr: string): number {
    return Math.floor(
        Date.parse(dateStr.slice(0, ISO_DATE_LENGTH) + 'T00:00:00Z') / 1000
    );
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
 *
 * 재측정: `node --expose-gc`에서 5년 일봉 `Bar[]` N벌을 만들어 두기 전후에 `gc()` →
 * `process.memoryUsage().heapUsed`를 재고, 증가분 ÷ N이 한 벌의 크기다.
 */
const HISTORY_MEMORY_MAX_ENTRIES = 128;

/**
 * 히스토리 L1의 TTL 상한. 유효성은 엔트리의 `asOf`·`checkedAt`이 정하지만(L1 hit에도 같은
 * 판정을 한다), 다른 인스턴스가 Redis 쪽을 먼저 갱신할 수 있다. 메모리 쪽이 그보다 오래 낡은
 * 값을 쥐지 않도록 30분마다 Redis를 다시 본다 — 그 비용은 키당 GET 한 번이다.
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
 * 시세 스냅샷 키. `getQuote`(시세)와 일봉의 오늘 봉(`getCachedDailyBars`)이 같은 키를
 * 읽는다 — 둘 다 업스트림 `quote` 한 번에서 나오는데, 예전에는 `quote:<SYM>`과
 * `bars:today:<SYM>` 두 키로 같은 데이터를 두 번 받았다.
 *
 * 이름이 `quote:<SYM>`/`bars:today:<SYM>`과 겹치지 않아야 한다: 옛 키는 각각 `MarketQuote`·
 * `Bar[]` 모양이라, 같은 키를 재사용하면 배포 직후 옛 엔트리를 스냅샷으로 잘못 읽는다.
 * 옛 키는 읽는 코드가 없어 각자의 세션 TTL로 저절로 사라진다.
 */
function buildQuoteSnapshotKey(symbol: string): string {
    return `quote:snapshot:${symbol.toUpperCase()}`;
}

/**
 * 둘 다 null(조회 실패·빈 응답)인 스냅샷은 굳히지 않는다.
 *
 * 한쪽만 있는 스냅샷은 굳힌다 — 예전 두 가드(`quote`는 null 미저장, `bars:today`는 빈
 * 봉 미저장)와 다른 점이다. 두 방향 모두 의도적으로 허용한다:
 * - 시세만 있고 오늘 봉이 없음: FMP quote 행의 timestamp가 깨져 오늘 봉 매핑만 실패할 때다.
 *   TTL 동안 오늘 봉 없이(live tail 없음) 서빙하고, 그 종목의 1Day 조회마다 FMP를 다시
 *   부르지 않는다.
 * - 오늘 봉만 있고 시세가 없음: 시세 매핑만 실패할 때다(지금 매퍼로는 사실상 생기지 않는다).
 *   TTL 동안 `getQuote`가 `null`을 돌려준다 — 예전엔 null 시세를 굳히지 않았다.
 * 어느 쪽이든 같은 행을 다시 받아도 같은 결과라 재조회로 얻을 것이 없다. TTL은 장중 60초다.
 */
function isUsableSnapshot(snapshot: QuoteSnapshot): boolean {
    return snapshot.quote !== null || snapshot.todayBar !== null;
}

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
 * runAnalysis/runOverallAnalysis), 여기서 캐싱하면 차트·분석·시세 스냅샷(today-quote)·
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
     * 히스토리 L1. Redis 히스토리 키는 세션이 바뀔 때만 갱신되는데, 장중에는 종목 페이지·섹터
     * 스캔이 그 키(5년 일봉 ~41KB 압축)를 분마다 다시 GET했다. 같은 인스턴스가 이미 들고
     * 있는 값이라 메모리에서 낸다. 일봉은 {@link EodHistoryEntry}, 인트라데이는 `Bar[]`를
     * 담는다 — 한 LRU에 섞어 둬야 인스턴스 힙 상한(`HISTORY_MEMORY_MAX_ENTRIES`)이 하나로 유지된다.
     */
    private readonly historyMemory: MemoryLru<Bar[] | EodHistoryEntry> =
        createMemoryLru<Bar[] | EodHistoryEntry>(HISTORY_MEMORY_MAX_ENTRIES);

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
     * - today `quote:snapshot:<SYM>`: `inner.getQuoteSnapshot`의 `todayBar`(quote 기반 OHLCV) 세션 TTL(장중 60s).
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
            this.getEodHistory(options, {
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
            this.getHistory(
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
     * 일봉 EOD 히스토리를 읽는다: L1 → Redis(`getOrSetCache`) → 증분 갱신 또는 전체 fetch.
     *
     * 엔트리가 `isEntryServable`이면 업스트림 호출 없이 낸다. 아니면(세션이 바뀜, 불완전 쿨다운
     * 만료, 요청 창을 못 덮음) 낡은 엔트리를 밑천으로 `refreshEodHistory`가 겹쳐 받아 이어 붙이거나,
     * 이어 붙일 수 없으면 고정 창 전체를 받는다. 빈 결과는 어디에도 두지 않는다.
     *
     * ## 동시성: 왜 `getOrSetCache`의 `isFresh` 클로저로 낡은 엔트리를 붙잡는가
     *
     * 세션이 넘어가는 순간 차트·분석·fear&greed·섹터 스캔·프리웜이 같은 종목을 동시에 요청한다.
     * 증분인지 전체인지 정하려면 캐시 값을 먼저 봐야 하는데, 별도로 GET하면 41KB를 한 번 더 받고
     * 단일 비행(single-flight)도 직접 만들어야 한다. `getOrSetCache`는 같은 키의 miss를 하나의
     * fetch로 접으므로(`inFlight`), 그 `isFresh` 판정 자리에서 "낡은 값이었다"를 클로저 변수에
     * 담아 두면 소유자의 fetcher가 그 값을 밑천으로 쓴다 — GET은 한 번이고 업스트림 호출도 키당
     * 하나다. 대기자는 소유자 결과가 자기 기준에 맞으면 그대로 받고, 안 맞으면(세션 경계에서
     * 서로 `lastClosed`가 다름, 더 이른 `from`) 소유자 결과를 밑천 삼아 직접 갱신한다(캐시에는
     * 쓰지 않는다 — `getOrSetCache` 규약).
     *
     * Redis가 없거나 GET이 실패하면 L1의 낡은 엔트리가 밑천이다(L1이 비어 있으면 전체 fetch).
     */
    private async getEodHistory(
        options: GetBarsOptions,
        ctx: EodServeContext
    ): Promise<Bar[]> {
        const key = `${EOD_HISTORY_KEY_PREFIX}:${options.symbol.toUpperCase()}`;
        const memo = this.historyMemory.get(key);
        let stale: EodHistoryEntry | undefined;
        if (memo !== undefined && !Array.isArray(memo)) {
            if (isEntryServable(memo, ctx)) return memo.bars;
            stale = memo;
        }

        const entry = await getOrSetCache<EodHistoryEntry>(
            key,
            EOD_HISTORY_TTL_SECONDS,
            () => this.refreshEodHistory(options, ctx, stale),
            fetched => fetched.bars.length > 0,
            cached => {
                const servable = isEntryServable(cached, ctx);
                // 낡았지만 읽힌 값은 증분 갱신의 밑천이다. 같은 키에 둘 이상이면 가장 최근
                // `checkedAt`이 더 많은 봉을 안다.
                if (
                    !servable &&
                    (stale === undefined || cached.checkedAt >= stale.checkedAt)
                ) {
                    stale = cached;
                }
                return servable;
            }
        );
        if (entry.bars.length > 0 && isEntryServable(entry, ctx)) {
            this.historyMemory.set(
                key,
                entry,
                HISTORY_MEMORY_TTL_CAP_SECONDS * MS_PER_SECOND
            );
        }
        return entry.bars;
    }

    /**
     * 낡은 엔트리(`stale`) 뒤를 이어 붙이거나, 못 하면 고정 창 전체를 받아 새 엔트리를 만든다.
     *
     * 증분: `from` = 마지막 캐시 봉의 날짜(포함)로 `before=lastClosed`까지 받는다. 그 봉이 캐시와
     * 같으면(`overlapStatus`) 이후 봉만 이어 붙이고 새 창 앞쪽을 자른다(`fullAt`은 이어받는다). 다르거나 응답에 없으면
     * 분할 등으로 과거가 소급 조정됐거나 알 수 없는 상태이므로 전체 창을 다시 받는다 — 분할 뒤
     * 단순 이어 붙이기는 차트·지표를 조용히 망가뜨리기 때문이다. 증분 호출이 던지면 그대로
     * 전파한다(전체 fetch와 같은 장애 정책, 장애를 캐시하지 않는다).
     */
    private async refreshEodHistory(
        options: GetBarsOptions,
        ctx: EodServeContext,
        stale: EodHistoryEntry | undefined
    ): Promise<EodHistoryEntry> {
        const fromThreshold = utcMidnightSeconds(ctx.fetchFrom);
        const build = (bars: Bar[], fullAt: number): EodHistoryEntry => ({
            asOf: ctx.lastClosed,
            from: ctx.fetchFrom,
            checkedAt: ctx.nowMs,
            fullAt,
            bars,
        });
        const fetchBars = (from: string): Promise<Bar[]> =>
            this.inner.getBars({ ...options, from, before: ctx.lastClosed });

        const cachedLast = stale?.bars.at(-1);
        if (
            stale !== undefined &&
            cachedLast !== undefined &&
            canExtendIncrementally(stale, ctx, fromThreshold)
        ) {
            // `from`을 포함하는지는 실측으로 확인했다(2026-10): FMP `eod/full`은 `from` 날짜 봉을
            // 포함하고, yahoo chart는 `period1 = '2026-10-07'`에 2026-10-07T00:00:00Z 봉을 준다
            // (005930.KS). 두 공급자 모두 겹침 봉이 응답에 들어온다.
            const fetched = await fetchBars(
                toUtcIsoDate(new Date(cachedLast.time * MS_PER_SECOND))
            );
            const status = overlapStatus(cachedLast, fetched);
            if (status === 'match') {
                return build(
                    trimToWindow(
                        mergeIncremental(stale.bars, fetched, cachedLast.time),
                        fromThreshold
                    ),
                    stale.fullAt
                );
            }
            // 영구적으로 반복되면(경계 의미가 다른 공급자 등) 증분의 이득이 사라지므로 보이게 남긴다.
            console.warn(
                '[CachedMarketDataProvider] eodhist overlap mismatch, full refetch:',
                options.symbol.toUpperCase(),
                status
            );
        }
        return build(await fetchBars(ctx.fetchFrom), ctx.nowMs);
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
        if (memo !== undefined && Array.isArray(memo) && isFresh(memo))
            return memo;
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

    /**
     * `getQuote`와 일봉 오늘 봉이 공유하는 단일 읽기 경로. 두 호출자가 같은 키를 같은
     * `ttl`·`isUsableSnapshot`으로 부르므로 `getOrSetCache`의 in-flight 공유(소유자 인자가
     * 전원에게 적용된다)와 어긋나지 않는다 — 새 호출자를 더하면 이 메서드만 거칠 것.
     * 업스트림에는 첫 호출자의 symbol 표기가 그대로 간다(키만 대문자화).
     */
    private getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot> {
        return getOrSetCache(
            buildQuoteSnapshotKey(symbol),
            this.ttl(QUOTE_TTL_TIMEFRAME),
            () => this.inner.getQuoteSnapshot(symbol),
            isUsableSnapshot
        );
    }

    getQuote = async (symbol: string): Promise<MarketQuote | null> =>
        (await this.getQuoteSnapshot(symbol)).quote;
}
