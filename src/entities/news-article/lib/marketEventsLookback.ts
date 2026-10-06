import type { Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';

/**
 * 타임프레임별 뉴스 조회 창(일). 벽시계 기준이다.
 *
 * core는 봉 범위보다 넓게 이벤트를 받아 프롬프트에 그리므로(`selectMarketEvents`),
 * 이 창의 **하한(`from`)이 곧 프롬프트에 실리는 이벤트의 실질 하한**이다 —
 * 봉 범위를 덮으려는 근사값이 아니다. 봉 개수(`recentBarsCount`)와는 무관하다.
 *
 * 일 단위 하한을 UTC 자정으로 내리는 이유(`startOfUtcDay`)는 캐시 키 안정성이다.
 * 이 창이 만든 이벤트 집합을 core가 캐시 키에 접는다(`narrowMarketEventsForCacheKey`).
 * 하한이 밀리초 단위로 미끄러지면 이벤트가 경계를 넘는 순간 키가 바뀌어,
 * T 시점에 pre-warm이 채운 캐시를 T+Δ의 방문자가 맞히지 못한다. 하한을 UTC 날짜로
 * 고정하면 집합이 UTC 하루 동안 고정된다. 참고로 core 2.13.1부터는 `session`을
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

/** 순간 `date`가 속한 UTC 날짜의 00:00:00.000Z. */
function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

/** `findMarketEventsForPrompt`에 넘길 조회 구간. */
export interface MarketEventsLookbackWindow {
    /** 조회 하한(포함). 항상 UTC 자정이다 — 같은 UTC 날짜 안에서는 고정. */
    from: Date;
    /** 조회 상한(포함). 보통 현재 시각. */
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
 * `from`은 `startOfUtcDay(now) - N일`로 일 단위로 내려 고정한다. 그래서 실제
 * 창 길이는 `[N, N+1)`일이다(모듈 JSDoc 참고).
 *
 * @param timeframe - 분석 타임프레임.
 * @param now - 창의 상한. 테스트에서 고정하기 위해 주입 가능하다.
 */
export function marketEventsLookback(
    timeframe: Timeframe,
    now: Date = new Date()
): MarketEventsLookbackWindow {
    return {
        from: new Date(
            startOfUtcDay(now).getTime() - LOOKBACK_DAYS[timeframe] * MS_PER_DAY
        ),
        to: now,
    };
}
