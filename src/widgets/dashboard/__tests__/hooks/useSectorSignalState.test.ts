// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useSectorSignalState } from '@/widgets/dashboard/hooks/useSectorSignalState';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { TEST_SCOPE } from '../helpers/testScope';

const mockReplace = vi.fn();
let mockSearchParamsString = '';
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

vi.mock('@/entities/analysis', () => ({
    EMPTY_QUADRANTS: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    filterStrictAnticipation: (stocks: unknown[]) => stocks,
    resolveConflicts: (stocks: unknown[]) => ({
        resolved: stocks,
        mixed: [],
    }),
    groupStockIntoQuadrants: (
        acc: Record<string, unknown[]>,
        _stock: unknown
    ) => acc,
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: '기술' },
        { symbol: 'XLF', koreanName: '금융' },
    ],
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
    DASHBOARD_TIMEFRAMES: ['15Min', '1Hour', '1Day'],
    isDashboardTimeframe: (value: unknown) =>
        ['15Min', '1Hour', '1Day'].includes(value as string),
}));

const SECTOR_DATA: SectorSignalsResult = {
    stocks: [
        {
            symbol: 'AAPL',
            koreanName: 'Apple',
            sectorSymbol: 'XLK',
            price: 150,
            changePercent: 1.5,
            trend: 'uptrend' as const,
            signals: [],
        },
    ],
    computedAt: '2025-01-01T00:00:00Z',
};

// useSectorSignals 내부 훅을 mock 처리 — React Query 의존 제거.
// 시그니처가 `(scope, timeframe, initialData)`로 바뀌었다 — 인자 위치가 어긋나면
// `initialData`가 timeframe 자리로 들어가 조용히 undefined가 된다.
const mockUseSectorSignals = vi.hoisted(() => vi.fn());
vi.mock('@/widgets/dashboard/hooks/useSectorSignals', () => ({
    useSectorSignals: (
        scope: unknown,
        tf: unknown,
        initialData?: SectorSignalsResult
    ) => {
        // **인자를 기록한다.** 예전 목은 인자를 버려서 `useSectorSignals('us', …)`로
        // 하드코딩해도 아무 테스트가 안 깨졌다 — `/market/kr`이 KR SSR 시드를 그린 뒤
        // 하이드레이션과 함께 미국 신호로 갈아치우는 회귀가 그대로 통과한다.
        mockUseSectorSignals(scope, tf, initialData);
        return initialData ?? SECTOR_DATA;
    },
}));

describe('useSectorSignalState', () => {
    afterEach(() => {
        mockReplace.mockClear();
        mockSearchParamsString = '';
    });

    it('returns initial sector and timeframe', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );
        expect(result.current.activeSector).toBe('XLK');
        expect(result.current.activeTimeframe).toBe('1Day');
    });

    it('handleSectorChange updates sector and calls router.replace', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLF');
        });

        expect(result.current.activeSector).toBe('XLF');
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('handleTimeframeChange updates timeframe and calls router.replace', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleTimeframeChange('1Hour');
        });

        expect(result.current.activeTimeframe).toBe('1Hour');
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('uses pathname without query when both sector and timeframe are defaults', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLF',
                initialTimeframe: '1Hour',
            })
        );

        // Switch both to defaults → qs should be empty → url = pathname only
        act(() => {
            result.current.handleTimeframeChange('1Day');
        });
        mockReplace.mockClear();

        act(() => {
            result.current.handleSectorChange('XLK');
        });

        const url = mockReplace.mock.calls[0]?.[0] as string;
        expect(url).toBe('/dashboard');
    });

    it('omits default sector and timeframe from query string', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLF',
                initialTimeframe: '1Hour',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLK');
        });

        const url = mockReplace.mock.calls[0]?.[0] as string;
        expect(url).not.toContain('sector=');
        expect(url).toContain('timeframe=1Hour');
    });

    it('(B6) restores sector and timeframe from URL on mount', async () => {
        mockSearchParamsString = 'sector=XLF&timeframe=1Hour';

        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        // useEffect runs after mount — act() ensures the state update is flushed
        await act(async () => {});

        expect(result.current.activeSector).toBe('XLF');
        expect(result.current.activeTimeframe).toBe('1Hour');
    });

    it('(B6) falls back to prop defaults when URL timeframe is invalid', async () => {
        mockSearchParamsString = 'sector=XLF&timeframe=1Week';

        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        // sector=XLF is valid → restored; timeframe=1Week is invalid → fallback
        await act(async () => {});

        expect(result.current.activeSector).toBe('XLF');
        expect(result.current.activeTimeframe).toBe('1Day');
    });

    it('(B6) falls back to prop defaults when URL params are absent', async () => {
        mockSearchParamsString = '';

        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        await act(async () => {});

        expect(result.current.activeSector).toBe('XLK');
        expect(result.current.activeTimeframe).toBe('1Day');
    });

    it('scope.id를 useSectorSignals에 그대로 넘긴다', () => {
        const krScope = { ...TEST_SCOPE, id: 'kr' as const };
        renderHook(() =>
            useSectorSignalState({
                scope: krScope,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        expect(mockUseSectorSignals).toHaveBeenCalledWith(
            'kr',
            '1Day',
            undefined
        );
    });

    /**
     * `?sector=`는 임의의 문자열이다. scope 검증이 빠지면 `/market/kr?sector=XLK`가
     * 미국 섹터를 활성화해 탭에도 없는 값이 상태로 들어가고, 패널은 영구히 빈
     * 상태로 남는다(오류 없음).
     */
    it('scope에 없는 sector 쿼리는 초기값으로 폴백한다', () => {
        mockSearchParamsString = 'sector=XLE';

        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        expect(result.current.activeSector).toBe('XLK');
    });
});
