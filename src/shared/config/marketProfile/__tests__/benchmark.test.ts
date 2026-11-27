import { describe, expect, it } from 'vitest';
import { benchmarkFor } from '@/shared/config/marketProfile/benchmark';

describe('benchmarkFor', () => {
    it('미국 주식·ETF는 S&P 500(SPY)이다', () => {
        expect(benchmarkFor('us-equity', 'AAPL')).toEqual({
            symbol: 'SPY',
            label: 'S&P 500 (SPY)',
        });
        expect(benchmarkFor('us-equity', 'QQQ')?.symbol).toBe('SPY');
    });

    it('코스피 종목은 KOSPI(^KS11)이다', () => {
        expect(benchmarkFor('kr-equity', '005930.KS')).toEqual({
            symbol: 'KS11',
            fmpSymbol: '^KS11',
            label: 'KOSPI',
        });
    });

    it('코스닥 종목은 KOSDAQ(^KQ11)이다', () => {
        expect(benchmarkFor('kr-equity', '247540.KQ')).toEqual({
            symbol: 'KQ11',
            fmpSymbol: '^KQ11',
            label: 'KOSDAQ',
        });
    });

    it('크립토는 지수가 없다', () => {
        expect(benchmarkFor('crypto', 'BTC-USD')).toBeUndefined();
    });

    it('core 캐시 키 구분자(:)가 symbol에 들어가지 않는다', () => {
        for (const [p, s] of [
            ['us-equity', 'AAPL'],
            ['kr-equity', '005930.KS'],
            ['kr-equity', '247540.KQ'],
        ] as const) {
            expect(benchmarkFor(p, s)?.symbol).not.toContain(':');
        }
    });
});
