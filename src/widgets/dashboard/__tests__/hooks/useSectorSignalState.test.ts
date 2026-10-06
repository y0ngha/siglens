// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useSectorSignalState } from '@/widgets/dashboard/hooks/useSectorSignalState';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { TEST_SCOPE } from '../helpers/testScope';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => '/dashboard',
}));

/** 훅은 `useUrlSearchParam`(window.location)으로 읽으므로 실제 주소를 바꾼다. */
function setUrl(search: string): void {
    window.history.replaceState(
        null,
        '',
        search === '' ? '/dashboard' : `/dashboard?${search}`
    );
}

vi.mock('@/entities/analysis/lib/quadrants', () => ({
    EMPTY_QUADRANTS: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    filterStrictAnticipation: (stocks: unknown[]) => stocks,
    groupStockIntoQuadrants: (
        acc: Record<string, unknown[]>,
        _stock: unknown
    ) => acc,
}));
vi.mock('@/entities/analysis/lib/resolveConflicts', () => ({
    resolveConflicts: (stocks: unknown[]) => ({
        resolved: stocks,
        mixed: [],
    }),
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
        setUrl('');
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
        setUrl('sector=XLF&timeframe=1Hour');

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
        setUrl('sector=XLF&timeframe=1Week');

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
        setUrl('');

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
        setUrl('sector=XLE');

        const { result } = renderHook(() =>
            useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        expect(result.current.activeSector).toBe('XLK');
    });

    /**
     * 서버 HTML은 모든 방문자에게 같아야 한다(ISR). 서버 렌더는 쿼리를 읽지 않고 서버
     * seed와 같은 첫 섹터·기본 타임프레임을 그린다 — 딥링크는 하이드레이션 직후 반영된다.
     */
    it('서버 렌더에서는 URL을 읽지 않고 초기값을 쓴다', () => {
        setUrl('sector=XLF&timeframe=1Hour');
        const seen: [string, string][] = [];
        function Probe() {
            const state = useSectorSignalState({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            });
            seen.push([state.activeSector, state.activeTimeframe]);
            return null;
        }
        renderToString(createElement(Probe));
        expect(seen).toEqual([['XLK', '1Day']]);
    });

    describe('뒤로/앞으로 가기(popstate)', () => {
        it('사용자가 고른 섹터보다 popstate 뒤의 URL을 따른다', () => {
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

            // 뒤로 가기로 섹터 쿼리가 없는 항목에 도착했다 — 화면도 첫 섹터로 돌아가야 한다.
            act(() => {
                setUrl('');
                window.dispatchEvent(new PopStateEvent('popstate'));
            });
            expect(result.current.activeSector).toBe('XLK');
        });

        it('사용자가 고른 타임프레임보다 popstate 뒤의 URL을 따른다', () => {
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

            act(() => {
                setUrl('timeframe=15Min');
                window.dispatchEvent(new PopStateEvent('popstate'));
            });
            expect(result.current.activeTimeframe).toBe('15Min');
        });

        it('popstate 뒤에 다시 고르면 그 선택이 URL보다 우선한다', () => {
            const { result } = renderHook(() =>
                useSectorSignalState({
                    scope: TEST_SCOPE,
                    initialSector: 'XLK',
                    initialTimeframe: '1Day',
                })
            );

            act(() => {
                setUrl('sector=XLK');
                window.dispatchEvent(new PopStateEvent('popstate'));
            });
            act(() => {
                result.current.handleSectorChange('XLF');
            });
            expect(result.current.activeSector).toBe('XLF');
        });
    });
});
