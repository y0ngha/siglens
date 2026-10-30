// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import { useSectorSignalState } from '@/widgets/dashboard/hooks/useSectorSignalState';
import { TEST_SCOPE } from '../helpers/testScope';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn() }),
    usePathname: () => '/dashboard',
}));

const mockUseSectorSignals = vi.hoisted(() => vi.fn());
vi.mock('@/widgets/dashboard/hooks/useSectorSignals', () => ({
    useSectorSignals: mockUseSectorSignals,
}));

const RETRY = vi.fn();

function stock(
    symbol: string,
    sectorSymbol: string,
    overrides: Partial<StockSignalResult> = {}
): StockSignalResult {
    return {
        symbol,
        koreanName: symbol,
        sectorSymbol,
        price: 100,
        changePercent: 1,
        trend: 'uptrend',
        signals: [
            {
                type: 'golden_cross',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 1,
            },
        ],
        ...overrides,
    };
}

const SECTOR_DATA: SectorSignalsResult = {
    computedAt: '2025-01-01T00:00:00Z',
    stocks: [stock('AAPL', 'XLK'), stock('JPM', 'XLF')],
};

function renderState(initialData?: SectorSignalsResult) {
    return renderHook(() =>
        useSectorSignalState({
            scope: TEST_SCOPE,
            initialSector: 'XLK',
            initialTimeframe: '1Day',
            initialData,
        })
    );
}

describe('useSectorSignalState', () => {
    afterEach(() => {
        mockUseSectorSignals.mockReset();
    });

    describe('조회 성공', () => {
        beforeEach(() => {
            mockUseSectorSignals.mockReturnValue({
                data: SECTOR_DATA,
                status: 'ready',
                retry: RETRY,
            });
        });

        it('선택한 섹터의 종목만 사분면에 담는다', () => {
            const { result } = renderState();
            expect(
                result.current.view.quadrants.bullishConfirmed.map(
                    s => s.symbol
                )
            ).toEqual(['AAPL']);
        });

        it('status와 retry를 그대로 노출한다', () => {
            const { result } = renderState();
            expect(result.current.status).toBe('ready');
            expect(result.current.retry).toBe(RETRY);
        });
    });

    it('scope.id·활성 타임프레임·initialData를 useSectorSignals에 넘긴다', () => {
        mockUseSectorSignals.mockReturnValue({
            data: SECTOR_DATA,
            status: 'ready',
            retry: RETRY,
        });
        renderState(SECTOR_DATA);
        expect(mockUseSectorSignals).toHaveBeenCalledWith(
            'us',
            '1Day',
            SECTOR_DATA
        );
    });

    it('데이터가 없는 동안에는 빈 화면 구성과 loading 상태를 노출한다', () => {
        mockUseSectorSignals.mockReturnValue({
            data: undefined,
            status: 'loading',
            retry: RETRY,
        });
        const { result } = renderState();
        expect(result.current.status).toBe('loading');
        expect(result.current.view.mixedStocks).toEqual([]);
        expect(result.current.view.quadrants.bullishConfirmed).toEqual([]);
    });

    it('조회가 실패하면 error 상태를 노출한다', () => {
        mockUseSectorSignals.mockReturnValue({
            data: undefined,
            status: 'error',
            retry: RETRY,
        });
        const { result } = renderState();
        expect(result.current.status).toBe('error');
    });
});
