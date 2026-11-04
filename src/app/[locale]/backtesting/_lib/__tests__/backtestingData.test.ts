const derived = vi.hoisted(() => ({
    deriveBacktestStats: vi.fn(),
}));
vi.mock('@/entities/backtest-case/data/data.json', () => ({
    default: {
        run: { tickers: ['NVDA', 'AAPL', 'SPY'] },
        baselines: [],
        trades: [],
    },
}));
vi.mock('@/entities/backtest-case/lib/validate', () => ({
    validateBacktestRunData: (data: unknown) => data,
}));
vi.mock('@/entities/backtest-case/lib/deriveBacktestStats', () => ({
    deriveBacktestStats: derived.deriveBacktestStats.mockReturnValue({
        periodStart: '2024-11-01',
        periodEnd: '2026-11-02',
    }),
}));

import {
    BACKTEST_RUN,
    BACKTEST_STATS,
    BACKTEST_TICKERS,
} from '@/app/[locale]/backtesting/_lib/backtestingData';

describe('backtesting 데이터', () => {
    it('티커 목록은 실행 정보의 순서를 그대로 따른다', () => {
        expect(BACKTEST_TICKERS).toEqual(['NVDA', 'AAPL', 'SPY']);
    });

    it('통계는 검증된 실행 데이터 전체에서 파생한다', () => {
        expect(derived.deriveBacktestStats).toHaveBeenCalledWith(BACKTEST_RUN);
    });

    it('통계는 파생 결과 그대로 노출한다', () => {
        expect(BACKTEST_STATS).toEqual({
            periodStart: '2024-11-01',
            periodEnd: '2026-11-02',
        });
    });
});
