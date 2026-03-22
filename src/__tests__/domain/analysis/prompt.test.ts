import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type { Bar, IndicatorResult } from '@/domain/types';

const makeBar = (i: number): Bar => ({
    time: 1700000000 + i * 60,
    open: 100 + i,
    high: 110 + i,
    low: 90 + i,
    close: 105 + i,
    volume: 1000,
});

const indicators: IndicatorResult = {
    macd: [],
    bollinger: [],
    dmi: [],
};

describe('buildAnalysisPrompt', () => {
    it('문자열을 반환한다', () => {
        const result = buildAnalysisPrompt('AAPL', [], indicators);
        expect(typeof result).toBe('string');
    });

    it('bars가 있어도 문자열 반환', () => {
        const bars = Array.from({ length: 3 }, (_, i) => makeBar(i));
        const result = buildAnalysisPrompt('TSLA', bars, indicators);
        expect(typeof result).toBe('string');
    });
});
