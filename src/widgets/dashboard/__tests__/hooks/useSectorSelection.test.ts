// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useSectorSelection } from '@/widgets/dashboard/hooks/useSectorSelection';
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

vi.mock('@/shared/config/dashboard-tickers', () => ({
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
    DASHBOARD_TIMEFRAMES: ['15Min', '1Hour', '1Day'],
    isDashboardTimeframe: (value: unknown) =>
        ['15Min', '1Hour', '1Day'].includes(value as string),
}));

describe('useSectorSelection', () => {
    afterEach(() => {
        mockReplace.mockClear();
        setUrl('');
    });

    it('returns initial sector and timeframe', () => {
        const { result } = renderHook(() =>
            useSectorSelection({
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
            useSectorSelection({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLF');
        });

        expect(result.current.activeSector).toBe('XLF');
        expect(mockReplace).toHaveBeenCalledWith('/dashboard?sector=XLF', {
            scroll: false,
        });
    });

    it('handleTimeframeChange updates timeframe and calls router.replace', () => {
        const { result } = renderHook(() =>
            useSectorSelection({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleTimeframeChange('1Hour');
        });

        expect(result.current.activeTimeframe).toBe('1Hour');
        expect(mockReplace).toHaveBeenCalledWith('/dashboard?timeframe=1Hour', {
            scroll: false,
        });
    });

    it('uses pathname without query when both sector and timeframe are defaults', () => {
        const { result } = renderHook(() =>
            useSectorSelection({
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

        expect(mockReplace).toHaveBeenCalledWith('/dashboard', {
            scroll: false,
        });
    });

    it('omits default sector and timeframe from query string', () => {
        const { result } = renderHook(() =>
            useSectorSelection({
                scope: TEST_SCOPE,
                initialSector: 'XLF',
                initialTimeframe: '1Hour',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLK');
        });

        expect(mockReplace).toHaveBeenCalledWith('/dashboard?timeframe=1Hour', {
            scroll: false,
        });
    });

    it('restores sector and timeframe from URL on mount', async () => {
        setUrl('sector=XLF&timeframe=1Hour');

        const { result } = renderHook(() =>
            useSectorSelection({
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

    it('falls back to prop defaults when URL timeframe is invalid', async () => {
        setUrl('sector=XLF&timeframe=1Week');

        const { result } = renderHook(() =>
            useSectorSelection({
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

    it('falls back to prop defaults when URL params are absent', async () => {
        setUrl('');

        const { result } = renderHook(() =>
            useSectorSelection({
                scope: TEST_SCOPE,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        await act(async () => {});

        expect(result.current.activeSector).toBe('XLK');
        expect(result.current.activeTimeframe).toBe('1Day');
    });

    /**
     * `?sector=`는 임의의 문자열이다. scope 검증이 빠지면 `/market/kr?sector=XLK`가
     * 미국 섹터를 활성화해 탭에도 없는 값이 상태로 들어가고, 패널은 영구히 빈
     * 상태로 남는다(오류 없음).
     */
    it('scope에 없는 sector 쿼리는 초기값으로 폴백한다', () => {
        setUrl('sector=XLE');

        const { result } = renderHook(() =>
            useSectorSelection({
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
            const state = useSectorSelection({
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
                useSectorSelection({
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
                useSectorSelection({
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
                useSectorSelection({
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
