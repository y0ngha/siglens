import type { Bar } from '@y0ngha/siglens-core';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const FIRST_DAY_SEC = Date.UTC(2026, 4, 18) / 1000; // 2026-05-18 (Mon)
const WEEKDAYS_PER_WEEK = 5;
const DAYS_PER_WEEK = 7;

/** 평일만 세는 일봉 날짜들 — 일봉은 거래일 UTC 자정에 찍힌다. 월요일부터 5일씩 채우고 주말 이틀을 건너뛴다. */
function weekdayTimes(count: number): number[] {
    return Array.from(
        { length: count },
        (_, i) =>
            FIRST_DAY_SEC +
            (Math.floor(i / WEEKDAYS_PER_WEEK) * DAYS_PER_WEEK +
                (i % WEEKDAYS_PER_WEEK)) *
                SECONDS_PER_DAY
    );
}

/** 일봉 130개: 앞 110개는 100 → 90의 완만한 하락, 뒤 20개는 90 → 112의 급등. */
export const BAR_COUNT = 130;
export const DECLINE_BARS = 110;
export function rallyBars(): Bar[] {
    return weekdayTimes(BAR_COUNT).map((time, i) => {
        const close =
            i < DECLINE_BARS
                ? 100 - (10 * i) / DECLINE_BARS
                : 90 +
                  (22 * (i - DECLINE_BARS + 1)) / (BAR_COUNT - DECLINE_BARS);
        return {
            time,
            open: close,
            high: close + 0.5,
            low: close - 0.5,
            close,
            volume: 1_000_000,
        };
    });
}

export function tradingDateOf(bars: readonly Bar[], index: number): string {
    return new Date(bars[index].time * 1000).toISOString().slice(0, 10);
}

/** 그날 장 마감 뒤(UTC 22:00 — 미국 동부 마감 이후)에 만든 분석의 생성 시각. */
export function analyzedAfterClose(
    bars: readonly Bar[],
    index: number
): string {
    return `${tradingDateOf(bars, index)}T22:00:00.000Z`;
}

/** 도구 결과의 `analysis` 투영 모양 — 대화에 저장되는 것과 같다(가격대·계획 포함). */
export function earlierProjection(): Record<string, unknown> {
    return {
        summary: '이전 분석',
        trend: 'bearish',
        riskLevel: 'medium',
        keyLevels: {
            support: [{ price: 88, reason: '저점' }],
            resistance: [
                { price: 96, reason: '1차' },
                { price: 105, reason: '2차' },
            ],
        },
        priceTargets: null,
        actionRecommendation: {
            positionAnalysis: 'p',
            entry: 'e',
            exit: 'x',
            riskReward: 'r',
            entryPrices: [91, 92],
            stopLoss: 88,
            takeProfitPrices: [105],
        },
        patterns: [],
        candlePatterns: [],
        strategies: [],
    };
}

/**
 * 일봉 130개: 앞 110개는 100 → 90 하락, 다음 10개는 90 → 112 급등(추세가 중간에 위로 뒤집힘), 마지막 10개는
 * 112 → 80 급락(다시 아래로 돌아옴). 양 끝 종가에서 읽은 추세는 같고 중간에만 뒤집힌 시리즈다.
 */
function flipBackClose(i: number): number {
    if (i < DECLINE_BARS) return 100 - (10 * i) / DECLINE_BARS;
    if (i < DECLINE_BARS + 10) return 90 + (22 * (i - DECLINE_BARS + 1)) / 10;
    return 112 - (32 * (i - DECLINE_BARS - 9)) / 10;
}

export function flipBackBars(): Bar[] {
    return weekdayTimes(BAR_COUNT).map((time, i) => {
        const close = flipBackClose(i);
        return {
            time,
            open: close,
            high: close + 0.5,
            low: close - 0.5,
            close,
            volume: 1_000_000,
        };
    });
}

/** 일봉 300개가 짧은 주기로 흔들린다 — 같은 신호가 기간 안에 수십 번 다시 시작한다(신호 상한 시험용). */
export const OSCILLATING_BAR_COUNT = 300;
export function oscillatingBars(): Bar[] {
    return weekdayTimes(OSCILLATING_BAR_COUNT).map((time, i) => {
        const close = 100 + 12 * Math.sin(i / 2.5) + i * 0.02;
        return {
            time,
            open: close,
            high: close + 0.5,
            low: close - 0.5,
            close,
            volume: 1_000_000,
        };
    });
}
