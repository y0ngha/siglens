import { MS_PER_DAY } from '@/shared/config/time';

/**
 * 타임프레임별 뉴스 조회 창(일). 벽시계 기준이다.
 *
 * core는 이벤트를 **봉 범위**로 자르지만(`selectMarketEvents`), siglens는 봉을
 * 갖고 있지 않다 — core가 가져온다. 그래서 여기서는 봉 범위를 덮고도 남을
 * 벽시계 근사값으로 읽고, 정확한 절단은 core에 맡긴다. 넉넉히 읽어도 core가
 * 버리므로 과다 조회의 비용은 DB 왕복 하나뿐이다.
 *
 * 봉 개수(`recentBarsCount`)가 아니라 날짜로 잡는 이유는 봉이 거래 시간만
 * 세기 때문이다. 15분봉 40개는 거래 시간으로 10시간이지만 야간과 주말을
 * 건너뛰므로 벽시계로는 며칠에 걸칠 수 있다.
 *
 * ⚠️ **스트림 경로와 pre-warm 경로가 같은 값을 써야 한다.** 이 창이 갈리면
 * 두 경로가 서로 다른 이벤트 집합을 core에 넘기고, core가 그것을 캐시 키에
 * 접으므로(`narrowMarketEventsForCacheKey`) pre-warm이 채운 캐시를 방문자가
 * 맞히지 못한다.
 */
const LOOKBACK_DAYS: Record<string, number> = {
    '5Min': 2,
    '15Min': 3,
    '30Min': 4,
    '1Hour': 5,
    '4Hour': 14,
    '1Day': 60,
};

/** 알 수 없는 타임프레임에 쓰는 보수적 기본값. */
const DEFAULT_LOOKBACK_DAYS = 7;

/** `findMarketEventsForPrompt`에 넘길 조회 구간을 만든다. */
export function marketEventsLookback(
    timeframe: string,
    now: Date = new Date()
): { from: Date; to: Date } {
    const days = LOOKBACK_DAYS[timeframe] ?? DEFAULT_LOOKBACK_DAYS;
    return {
        from: new Date(now.getTime() - days * MS_PER_DAY),
        to: now,
    };
}
