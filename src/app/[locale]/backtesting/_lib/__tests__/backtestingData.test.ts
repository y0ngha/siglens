const derived = vi.hoisted(() => ({
    deriveBacktestStats: vi.fn(),
}));
vi.mock('@/entities/backtest-case/data/data.json', () => ({
    default: {
        cases: [
            { ticker: 'AAPL', date: '2025-01-01' },
            { ticker: 'TSLA', date: '2025-02-01' },
            { ticker: 'AAPL', date: '2025-03-01' },
        ],
    },
}));
vi.mock('@/entities/backtest-case/lib/validate', () => ({
    validateBacktestData: (data: unknown) => data,
}));
vi.mock('@/entities/backtest-case/lib/deriveBacktestStats', () => ({
    deriveBacktestStats: derived.deriveBacktestStats.mockReturnValue({
        periodStart: '2025-01',
        periodEnd: '2025-03',
    }),
}));

import {
    BACKTEST_DATA,
    BACKTEST_STATS,
    BACKTEST_TICKERS,
} from '@/app/[locale]/backtesting/_lib/backtestingData';

describe('backtesting 데이터', () => {
    it('티커 목록은 중복 없이 케이스 등장 순서를 따른다', () => {
        expect(BACKTEST_TICKERS).toEqual(['AAPL', 'TSLA']);
    });

    it('통계는 검증된 케이스 배열에서 파생한다', () => {
        expect(derived.deriveBacktestStats).toHaveBeenCalledWith(
            BACKTEST_DATA.cases
        );
    });

    it('통계는 파생 결과 그대로 노출한다', () => {
        expect(BACKTEST_STATS).toEqual({
            periodStart: '2025-01',
            periodEnd: '2025-03',
        });
    });
});
