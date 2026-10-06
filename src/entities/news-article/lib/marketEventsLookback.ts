import type { MarketSessionSpec, Timeframe } from '@y0ngha/siglens-core';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import {
    HOURS_PER_DAY,
    KST_OFFSET_HOURS,
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_MINUTE,
} from '@/shared/config/time';

/**
 * 타임프레임별 뉴스 조회 창(일). 벽시계 기준이다.
 *
 * core는 봉 범위보다 넓게 이벤트를 받아 프롬프트에 그리므로(`selectMarketEvents`),
 * 이 창의 **하한(`from`)이 곧 프롬프트에 실리는 이벤트의 실질 하한**이다 —
 * 봉 범위를 덮으려는 근사값이 아니다. 봉 개수(`recentBarsCount`)와는 무관하다.
 *
 * 하한을 UTC 자정으로 내리고(`startOfUtcDay`) 상한을 분석 캐시 창 시작으로 내리는
 * 이유(`cacheWindowStart`)는 캐시 키 안정성이다. 이 창이 만든 이벤트 집합을 core가
 * 캐시 키에 접는다(`narrowMarketEventsForCacheKey`). 경계가 밀리초 단위로 미끄러지면
 * 이벤트가 경계를 넘는 순간 키가 바뀌어, T 시점에 pre-warm이 채운 캐시를 T+Δ의
 * 방문자가 맞히지 못한다. 두 경계를 창 단위로 고정하면 집합이 한 캐시 창 동안
 * 고정된다. 참고로 core 2.13.1부터는 `session`을
 * 넘기면 마지막 봉 이후의 주말·휴장 이벤트도 키를 바꾸지 못한다 — 그래서 이
 * 창을 쓰는 모든 core 호출은 `session`도 함께 넘겨야 한다.
 *
 * 창이 일 단위인 이유는 봉이 거래 시간만 세기 때문이다. 15분봉 40개는 거래
 * 시간으로 10시간이지만 야간과 주말을 건너뛰므로 벽시계로는 며칠에 걸칠 수 있다.
 *
 * `Record<Timeframe, ...>`이라 타임프레임이 늘면 컴파일이 막는다 — 빠뜨린
 * 축이 조용히 기본값으로 흘러가지 않는다.
 */
const LOOKBACK_DAYS: Record<Timeframe, number> = {
    '5Min': 2,
    '15Min': 3,
    '30Min': 4,
    '1Hour': 5,
    '4Hour': 14,
    '1Day': 60,
};

/**
 * 버킷 창 길이(ms) — core `ANALYSIS_CACHE_TTL`의 사본(1Day는 세션 경계를 쓰므로 없다).
 *
 * core는 이 값을 공개 export하지 않는다(`@internal`, deep import 금지). core 값이
 * 바뀌면 여기도 함께 바꿔야 한다 — 창이 core보다 짧으면 같은 캐시 창 안에서 이벤트
 * 집합이 바뀌어 키가 갈린다.
 */
const ANALYSIS_CACHE_BUCKET_MS: Record<Exclude<Timeframe, '1Day'>, number> = {
    '5Min': 5 * MS_PER_MINUTE,
    '15Min': 15 * MS_PER_MINUTE,
    '30Min': 30 * MS_PER_MINUTE,
    '1Hour': MS_PER_HOUR,
    '4Hour': 4 * MS_PER_HOUR,
};

/**
 * 버킷의 정렬 기준 — core `CACHE_EXPIRY_HOUR_KST`(KST 05:00 = UTC 20:00)의 사본.
 * core의 prior-analysis 창(`priorAnalysisWindowStartMs`)과 같은 경계에 버킷을 맞춘다.
 */
const CACHE_EXPIRY_HOUR_KST = 5;

const BUCKET_OFFSET_MS =
    ((CACHE_EXPIRY_HOUR_KST - KST_OFFSET_HOURS + HOURS_PER_DAY) %
        HOURS_PER_DAY) *
    MS_PER_HOUR;

/**
 * 마감 뒤 분석 캐시가 만료되기까지의 대기 — core `ANALYSIS_CACHE_SETTLE_BUFFER_MINUTES`
 * (30)의 사본. core가 공개 export하지 않는다. 바뀌면 함께 바꾼다.
 */
const ANALYSIS_CACHE_SETTLE_BUFFER_MINUTES = 30;

/** core `priorAnalysisWindowStartMs`와 같은 계산 — 모든 버킷 길이가 하루를 나눈다. */
function bucketWindowStart(
    timeframe: Exclude<Timeframe, '1Day'>,
    now: Date
): Date {
    const windowMs = ANALYSIS_CACHE_BUCKET_MS[timeframe];
    const offsetMs = BUCKET_OFFSET_MS % windowMs;
    return new Date(
        Math.floor((now.getTime() - offsetMs) / windowMs) * windowMs + offsetMs
    );
}

/**
 * core가 분석 캐시를 만료시키는 **직전** 세션 경계 — core의 "다음 경계"(`atMs > now`)의
 * 짝이다. scheduled 시장은 직전 정규장 마감 + 30분(`lastClosedSessionCloseUtc`가
 * core와 같은 스펙의 주말·`closeMinuteFor` 휴장일·DST를 적용한다), always-open은
 * 오늘 UTC 자정.
 */
function sessionWindowStart(session: MarketSessionSpec, now: Date): Date {
    if (session.kind === 'always-open') return startOfUtcDay(now);
    return new Date(
        lastClosedSessionCloseUtc(
            session,
            now,
            ANALYSIS_CACHE_SETTLE_BUFFER_MINUTES
        ).getTime() +
            ANALYSIS_CACHE_SETTLE_BUFFER_MINUTES * MS_PER_MINUTE
    );
}

/**
 * `now`가 속한 분석 캐시 창의 시작 시각.
 *
 * core `computeEffectiveTtl`(dist `infrastructure/cache/config.js`)은 분석 TTL을
 * `min(ANALYSIS_CACHE_TTL[tf], 다음 일일 경계까지)`로 잡고, `session`을 넘기면 그 일일
 * 경계가 **세션 경계**다 — scheduled 시장은 다음 정규장 마감 + 30분
 * (`secondsUntilNextRegularClose(session, now, ANALYSIS_CACHE_SETTLE_BUFFER_MINUTES)` →
 * `domain/session.js` `nextRegularSessionBoundaryMs(..., 'close', 30)`, 주말·
 * `closeMinuteFor` 휴장일 건너뜀), always-open(크립토)은 다음 UTC 자정
 * (`secondsUntilNextUtcMidnight`).
 *
 * - 1Day: TTL 상한이 하루라 실질 수명을 세션 경계가 정한다 → 직전 세션 경계.
 * - 그 밖(5분~4시간): TTL 상한이 먼저 끝난다 → core prior-analysis 창과 같은 TTL 버킷.
 *   새 타임프레임은 `ANALYSIS_CACHE_BUCKET_MS`에 빠지면 컴파일이 막는다.
 */
function cacheWindowStart(
    timeframe: Timeframe,
    session: MarketSessionSpec,
    now: Date
): Date {
    return timeframe === '1Day'
        ? sessionWindowStart(session, now)
        : bucketWindowStart(timeframe, now);
}

/** 순간 `date`가 속한 UTC 날짜의 00:00:00.000Z. */
function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

/** `findMarketEventsForPrompt`에 넘길 조회 구간. */
export interface MarketEventsLookbackWindow {
    /** 조회 하한(포함). 항상 UTC 자정이다 — 같은 분석 캐시 창 안에서는 고정. */
    from: Date;
    /** 조회 상한(포함). 현재 분석 캐시 창의 시작 시각 — 같은 창 안에서는 고정. */
    to: Date;
}

/**
 * 이 타임프레임에서 읽어야 할 뉴스 구간을 만든다.
 *
 * ⚠️ **스트림 경로와 pre-warm 경로가 같은 값을 써야 한다.** 이 창이 갈리면
 * 두 경로가 서로 다른 이벤트 집합을 core에 넘기고, core가 그것을 캐시 키에
 * 접으므로(`narrowMarketEventsForCacheKey`) pre-warm이 채운 캐시를 방문자가
 * 맞히지 못한다. 그래서 상수를 이 모듈 한 곳에 둔다.
 *
 * **두 경계 모두 `now`가 속한 분석 캐시 창의 시작(`cacheWindowStart`)에서 파생한다.**
 * 그래서 한 캐시 창 안에서는 조회 구간이 통째로 고정되고, 이벤트 집합(= 캐시 키)은
 * 창 경계에서만 바뀐다(이미 읽힌 기사가 나중에 재분류되는 경우는 예외 — core가
 * 내용 변경으로 보고 일부러 키에 접는다).
 *
 * - `to`가 `now`이던 때는(2026-10 비용 감사) 창 안에서 새 고영향 기사가 들어올
 *   때마다 키가 바뀌어, 프리웜이 채운 분석을 방문자가 맞히지 못하고 같은 창 안에서
 *   몇 번이고 다시 생성했다. 지금 창이 시작된 뒤 발행된 기사는 **다음 창**부터
 *   실린다 — 캐시 hit이 어차피 창 끝까지 옛 분석을 주는 것과 같은 지연이다.
 * - 1Day 창은 core 만료와 같은 **세션 경계**다(`cacheWindowStart`). 장중 기사는 그
 *   시장의 마감 + 30분에 실리기 시작하고, 그 경계는 core가 캐시를 어차피 버리는 순간이라
 *   키가 창 중간에 뒤집히지 않는다. 그래서 `session`은 core 호출에 넘기는 것과
 *   **같은 스펙**이어야 한다(`sessionSpecFor`).
 * - `from`은 그 창 시작이 속한 UTC 날짜의 자정에서 N일을 뺀다. 그래서 실제 창 길이는
 *   `[N, N+1)`일이다(모듈 JSDoc 참고).
 *
 * @param timeframe - 분석 타임프레임.
 * @param session - 분석 대상 시장의 세션 — core `runAnalysis`에 넘기는 것과 같은 값.
 *   필수인 이유: 빠지면 그 호출부만 다른 창을 써 캐시 키가 갈린다(호출부가 모두 이미
 *   `sessionSpecFor`로 갖고 있다).
 * @param now - 기준 시각. 테스트에서 고정하기 위해 주입 가능하다.
 */
export function marketEventsLookback(
    timeframe: Timeframe,
    session: MarketSessionSpec,
    now: Date = new Date()
): MarketEventsLookbackWindow {
    const windowStart = cacheWindowStart(timeframe, session, now);
    return {
        from: new Date(
            startOfUtcDay(windowStart).getTime() -
                LOOKBACK_DAYS[timeframe] * MS_PER_DAY
        ),
        to: windowStart,
    };
}
