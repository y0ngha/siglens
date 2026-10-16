import type { Bar, SqueezeRiskContext } from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * 숏스퀴즈 점수에 넘기는 완결 일봉 수. core는 20세션 등락(`SQUEEZE_PRICE_CHANGE_SESSIONS`, 기준 봉 포함 21개)과 거래량 배수
 * (최근 5세션 + 그 앞 20세션 기준선 = 25개, `SQUEEZE_VOLUME_*_SESSIONS`)를 본다. 30이면 둘 다 채우고, 기준일 당일 봉이 끼어
 * core가 하나를 버려도(기준일 **이전** 봉만 쓴다) 남는다. core가 이 상수들을 export하지 않아 값으로 적는다.
 */
export const SQUEEZE_CONTEXT_BARS = 30;

/**
 * 일봉 → core `SqueezeRiskContext`(날짜·종가·거래량만, 최근 `SQUEEZE_CONTEXT_BARS`개). 지표 계산은 하지 않는다 — 20일 등락·
 * 거래량 배수는 core가 계산한다.
 *
 * 입력은 **마감된 세션까지로 자른 일봉**이어야 한다(`getSessionBarsStatic` — 형성 중 봉이 없어 같은 세션 안에서는 값이
 * 같고, 그래서 core 캐시 키·종합 분석 inputHash가 결정적이다). 일봉 `Bar.time`은 세션 날짜의 UTC 자정이라 UTC 날짜가 곧
 * 세션 날짜다. 종가가 양의 유한수가 아니거나 거래량이 음수인 봉은 버리고, 남는 봉이 없으면 `undefined`(가격 없는 판정).
 */
export function toSqueezeContext(
    bars: readonly Bar[]
): SqueezeRiskContext | undefined {
    const dailyBars = bars
        .filter(
            bar =>
                Number.isFinite(bar.close) &&
                bar.close > 0 &&
                Number.isFinite(bar.volume) &&
                bar.volume >= 0
        )
        .slice(-SQUEEZE_CONTEXT_BARS)
        .map(bar => ({
            date: toUtcIsoDate(new Date(bar.time * MS_PER_SECOND)),
            close: bar.close,
            volume: bar.volume,
        }));
    return dailyBars.length === 0 ? undefined : { dailyBars };
}
