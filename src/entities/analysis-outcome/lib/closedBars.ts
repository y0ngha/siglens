import type { Bar, MarketSessionSpec } from '@y0ngha/siglens-core';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import {
    INTRADAY_SETTLE_MINUTES,
    type OutcomeTimeframe,
    barSeconds,
} from './outcomePolicy';

/**
 * 형성 중인 봉을 떼어 낸다. core `buildOutcomeWindow`는 닫힌 봉만 받으며 그 보장은 호출자 몫이다 —
 * 형성 중 봉이 하나라도 섞이면 라벨이 아직 안 끝난 봉의 값을 "결과"로 읽는다.
 *
 * - `1Day`: 일봉 `time`은 세션 날짜의 UTC 자정이다(FMP·Yahoo 어댑터 공통 규약). UTC 날짜가
 *   `lastClosedSessionDate(spec, now)`(마감 + EOD 발행 버퍼가 지난 마지막 세션) 이하인 봉만 남긴다.
 *   주말·휴장·반장·서머타임·24/7(전날 UTC까지)은 그 함수가 시장 스펙으로 처리하므로 여기서 달력을
 *   다시 구현하지 않는다.
 * - 분봉: `time + 봉 길이 + 35분 ≤ now`인 봉만 남긴다.
 *
 * 순수 함수 — 시각은 인자로만 받는다(EN-1).
 */
export function closedBars(
    bars: readonly Bar[],
    timeframe: OutcomeTimeframe,
    spec: MarketSessionSpec,
    now: Date
): Bar[] {
    if (timeframe === '1Day') {
        const lastClosed = lastClosedSessionDate(spec, now);
        return bars.filter(
            bar =>
                toUtcIsoDate(new Date(bar.time * MS_PER_SECOND)) <= lastClosed
        );
    }
    const nowSeconds = now.getTime() / MS_PER_SECOND;
    const settleSeconds = INTRADAY_SETTLE_MINUTES * SECONDS_PER_MINUTE;
    const lengthSeconds = barSeconds(timeframe);
    return bars.filter(
        bar => bar.time + lengthSeconds + settleSeconds <= nowSeconds
    );
}
