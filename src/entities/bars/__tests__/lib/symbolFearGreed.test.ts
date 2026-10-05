vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    computeFearGreedIndex: vi.fn(() => ({ score: 58 })),
    computeFearGreedHistory: vi.fn((bars: { time: number }[]) =>
        bars.map(b => ({
            date: String(b.time),
            score: 50,
            label: 'NEUTRAL',
        }))
    ),
}));

import { describe, expect, it, vi } from 'vitest';
import {
    calculateIndicators,
    computeFearGreedIndex,
    type Bar,
    type BarsData,
} from '@y0ngha/siglens-core';
import {
    CLIENT_FEAR_GREED_HISTORY_POINTS,
    clientSymbolFearGreed,
    symbolFearGreedSnapshot,
} from '@/entities/bars/lib/symbolFearGreed';

function bar(i: number): Bar {
    return {
        time: 1_700_000_000 + i * 86_400,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
    };
}

function dataWith(longCount: number, standardCount: number): BarsData {
    const longBars = Array.from({ length: longCount }, (_, i) => bar(i));
    const bars = longBars.slice(-standardCount);
    return {
        bars,
        indicators: calculateIndicators(bars),
        fearGreedBars: longBars,
    };
}

describe('symbolFearGreed', () => {
    it('5년 일봉이 있으면 그 봉으로 스냅샷을 계산한다', () => {
        const data = dataWith(30, 10);

        expect(symbolFearGreedSnapshot(data)).toEqual({ score: 58 });
        expect(computeFearGreedIndex).toHaveBeenCalledWith(
            data.fearGreedBars,
            expect.any(Array)
        );
    });

    it('5년 일봉이 없으면 표준 봉과 그 매수·매도 거래량으로 계산한다', () => {
        const bars = Array.from({ length: 10 }, (_, i) => bar(i));
        const indicators = calculateIndicators(bars);

        symbolFearGreedSnapshot({ bars, indicators });

        expect(computeFearGreedIndex).toHaveBeenCalledWith(
            bars,
            indicators.buySellVolume
        );
    });

    /**
     * 클라이언트 응답은 최근 약 2년 history만 — 5년 전체를 보내면 응답이 2.5배가 된다.
     * 점수는 5년 기준으로 계산한 값 그대로다.
     */
    it('클라이언트용 결과는 history를 최근 CLIENT_FEAR_GREED_HISTORY_POINTS개로 자른다', () => {
        const total = CLIENT_FEAR_GREED_HISTORY_POINTS + 100;
        const data = dataWith(total, 500);

        const result = clientSymbolFearGreed(data);

        expect(result.snapshot).toEqual({ score: 58 });
        expect(result.history).toHaveLength(CLIENT_FEAR_GREED_HISTORY_POINTS);
        expect(result.history.at(-1)?.date).toBe(
            String(data.fearGreedBars!.at(-1)!.time)
        );
    });

    it('history가 기준보다 짧으면 그대로 보낸다', () => {
        const result = clientSymbolFearGreed(dataWith(40, 20));

        expect(result.history).toHaveLength(40);
    });
});
