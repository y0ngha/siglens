import { describe, expect, it } from 'vitest';
import { EMPTY_INDICATOR_RESULT, type BarsData } from '@y0ngha/siglens-core';
import {
    lastBarSessionDate,
    toSessionBarsData,
} from '@/entities/bars/lib/sessionBars';

/** `YYYY-MM-DD` 일봉(그 날 UTC 자정). */
function bar(date: string, close = 100) {
    return {
        time: Date.parse(`${date}T00:00:00Z`) / 1000,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000,
    };
}

const DATES = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];

function data(dates: readonly string[], withLong = true): BarsData {
    return {
        bars: dates.map(d => bar(d)),
        indicators: {
            ...EMPTY_INDICATOR_RESULT,
            rsi: dates.map(() => 50),
            buySellVolume: dates.map((_, i) => ({
                buyVolume: i,
                sellVolume: i,
            })),
        },
        ...(withLong
            ? { fearGreedBars: ['2026-09-30', ...dates].map(d => bar(d)) }
            : {}),
    } as BarsData;
}

describe('toSessionBarsData', () => {
    it('세션 날짜 뒤의 봉(장중 형성 봉 등)을 bars·fearGreedBars·buySellVolume에서 함께 뗀다', () => {
        const out = toSessionBarsData(data(DATES), '2026-10-05');

        expect(out.bars.map(b => b.time)).toEqual(
            DATES.slice(0, 3).map(d => bar(d).time)
        );
        expect(out.fearGreedBars?.at(-1)?.time).toBe(bar('2026-10-05').time);
        expect(out.fearGreedBars).toHaveLength(4);
        // 꼬리 정렬 — 뗀 봉 수(1)만큼 뒤에서 뗀다.
        expect(out.indicators.buySellVolume).toEqual([
            { buyVolume: 0, sellVolume: 0 },
            { buyVolume: 1, sellVolume: 1 },
            { buyVolume: 2, sellVolume: 2 },
        ]);
    });

    it('세션 날짜까지의 봉은 그대로 둔다 (그 날의 봉 포함)', () => {
        const out = toSessionBarsData(data(DATES), '2026-10-06');

        expect(out.bars).toHaveLength(4);
        expect(out.indicators.buySellVolume).toHaveLength(4);
    });

    it('지표는 buySellVolume 외에 비운다 — 지표 소비자는 이 값을 쓰면 안 된다', () => {
        const out = toSessionBarsData(data(DATES), '2026-10-06');

        expect(out.indicators.rsi).toEqual([]);
        expect(out.indicators).toEqual({
            ...EMPTY_INDICATOR_RESULT,
            buySellVolume: expect.any(Array),
        });
    });

    it('fearGreedBars가 없으면 만들지 않는다 (fearGreedInputs 폴백 경로 유지)', () => {
        const out = toSessionBarsData(data(DATES, false), '2026-10-06');

        expect('fearGreedBars' in out).toBe(false);
    });

    it('같은 세션 키면 언제 채웠든 같은 값이다 — 장중 형성 봉이 있어도 없어도', () => {
        const intraday = toSessionBarsData(data(DATES), '2026-10-05');
        const beforeOpen = toSessionBarsData(
            data(DATES.slice(0, 3)),
            '2026-10-05'
        );

        expect(intraday).toEqual(beforeOpen);
    });
});

describe('lastBarSessionDate', () => {
    it('마지막 일봉의 세션 날짜(UTC 자정 → YYYY-MM-DD)', () => {
        expect(lastBarSessionDate(data(DATES))).toBe('2026-10-06');
    });

    it('봉이 없으면 null', () => {
        expect(lastBarSessionDate(data([]))).toBeNull();
    });
});
