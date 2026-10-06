import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import type { Timeframe } from '@y0ngha/siglens-core';
import { useTimeframeChange } from '@/views/symbol/hooks/useTimeframeChange';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';

vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: (v: unknown) =>
        ['1Day', '1Week', '1Month'].includes(v as string),
}));

vi.mock('@/entities/bars/actions/getBarsAction', () => ({
    getBarsAction: vi.fn().mockResolvedValue({ bars: [], indicators: {} }),
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

// 훅은 `useUrlSearchParam`(window.location)으로 읽는다. 스파이를 걸기 전에 원본을 잡아
// 두고 테스트 URL을 세팅하는 데 쓴다 — 스파이로 세팅하면 호출 단언이 오염된다.
const realReplaceState = window.history.replaceState.bind(window.history);

function setUrl(search: string): void {
    realReplaceState(null, '', `/AAPL${search === '' ? '' : `?${search}`}`);
}

/** 뒤로/앞으로 가기 — 주소가 바뀐 뒤 브라우저가 popstate를 쏜다. */
function popTo(search: string): void {
    act(() => {
        setUrl(search);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
}

describe('useTimeframeChange', () => {
    // Timeframe changes go through window.history.replaceState instead of
    // router.replace, so this spy is the "navigation" under test.
    let mockReplace: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        setUrl('');
        mockReplace = vi.spyOn(window.history, 'replaceState');
    });

    afterEach(() => {
        mockReplace.mockRestore();
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('defaults to DEFAULT_TIMEFRAME when search param is absent', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(result.current.isTimeframeSwitching).toBe(false);
    });

    it('reads timeframe from the URL search param', async () => {
        setUrl('tf=1Week');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
        });
        expect(result.current.isTimeframeSwitching).toBe(false);
    });

    it('falls back to DEFAULT_TIMEFRAME for invalid search param', () => {
        setUrl('tf=invalid');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        expect(result.current.timeframe).toBe('1Day');
    });

    it('starts with timeframeChangeCount of 0', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('skips change when next timeframe equals current', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Day' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    /**
     * 서버 HTML은 모든 방문자에게 같아야 한다(ISR). 서버 렌더는 URL을 읽지 않고
     * DEFAULT_TIMEFRAME으로 차트를 그린다 — `?tf=`는 하이드레이션 직후 반영된다.
     */
    it('server render uses DEFAULT_TIMEFRAME even with a ?tf= deep link', () => {
        setUrl('tf=1Week');
        const seen: Timeframe[] = [];
        function Probe() {
            seen.push(useTimeframeChange('AAPL', false, true).timeframe);
            return null;
        }
        renderToString(
            createElement(makeWrapper(), null, createElement(Probe))
        );
        expect(seen).toEqual(['1Day']);
    });

    it('canonicalizes a non-1Day query for a hydrated free user via history.replaceState', () => {
        setUrl('tf=1Week');
        // Canonicalization uses window.history.replaceState (not router.replace):
        // the server ignores `tf`, so a router.replace() RSC round-trip is both
        // wasteful and race-droppable from this mount-time effect.

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', true, true),
            { wrapper: makeWrapper() }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(mockReplace).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith(null, '', '/AAPL?tf=1Day');
    });

    it('uses 1Day until the user tier has hydrated', () => {
        setUrl('tf=1Week');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, false),
            { wrapper: makeWrapper() }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does not navigate, prefetch, or change timeframe before tier hydration', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, false),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
        expect(getBarsAction).not.toHaveBeenCalled();
        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('is a no-op when a hydrated free user requests a non-default timeframe', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', true, true),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
        expect(getBarsAction).not.toHaveBeenCalled();
        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('restores a member query timeframe after hydration and refreshes analysis once', async () => {
        setUrl('tf=1Week');

        const { result, rerender } = renderHook(
            ({ isTierHydrated }: { isTierHydrated: boolean }) =>
                useTimeframeChange('AAPL', false, isTierHydrated),
            {
                wrapper: makeWrapper(),
                initialProps: { isTierHydrated: false },
            }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(result.current.timeframeChangeCount).toBe(0);

        rerender({ isTierHydrated: true });

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
            expect(result.current.timeframeChangeCount).toBe(1);
        });
        expect(mockReplace).not.toHaveBeenCalled();
    });

    /**
     * URL에서 온 변화(딥링크·tier 하이드레이션·popstate)는 긴급 업데이트다. 그대로 쓰면
     * 새 봉을 기다리는 `useSuspenseQuery`가 긴급 렌더에서 suspend해 ChartSkeleton이
     * 다시 뜬다. `useDeferredValue`로 넘기면 **한 번은 이전 timeframe으로 렌더**되고
     * (= 이전 차트 유지) 그동안 "바뀌는 중"이 켜진다.
     */
    describe('URL에서 온 변화는 이전 차트를 유지한 채 지연 적용한다(useDeferredValue)', () => {
        interface Snapshot {
            timeframe: Timeframe;
            displayTimeframe: Timeframe;
            isTimeframeSwitching: boolean;
        }

        function renderRecording(isTierHydrated: boolean) {
            const renders: Snapshot[] = [];
            const hook = renderHook(
                ({ hydrated }: { hydrated: boolean }) => {
                    const state = useTimeframeChange('AAPL', false, hydrated);
                    renders.push({
                        timeframe: state.timeframe,
                        displayTimeframe: state.displayTimeframe,
                        isTimeframeSwitching: state.isTimeframeSwitching,
                    });
                    return state;
                },
                {
                    wrapper: makeWrapper(),
                    initialProps: { hydrated: isTierHydrated },
                }
            );
            return { ...hook, renders };
        }

        it('tier 하이드레이션: 이전 timeframe으로 한 번 렌더하며 전환 중을 표시한다', async () => {
            setUrl('tf=1Week');
            const { result, rerender, renders } = renderRecording(false);
            renders.length = 0;

            rerender({ hydrated: true });

            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Week');
            });
            expect(renders).toContainEqual({
                timeframe: '1Day',
                displayTimeframe: '1Week',
                isTimeframeSwitching: true,
            });
            expect(result.current.isTimeframeSwitching).toBe(false);
        });

        it('?tf= 딥링크: 첫 렌더는 기본 timeframe(서버 HTML과 같음)이고 그다음 URL 값이다', async () => {
            setUrl('tf=1Week');
            const { result, renders } = renderRecording(true);

            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Week');
            });
            expect(renders[0]).toEqual({
                timeframe: '1Day',
                displayTimeframe: '1Week',
                isTimeframeSwitching: true,
            });
        });

        it('popstate: 이전 timeframe으로 한 번 렌더하며 전환 중을 표시한다', async () => {
            const { result, renders } = renderRecording(true);
            renders.length = 0;

            popTo('tf=1Month');

            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Month');
            });
            expect(renders).toContainEqual({
                timeframe: '1Day',
                displayTimeframe: '1Month',
                isTimeframeSwitching: true,
            });
        });
    });

    it('prefetches bars and navigates when a member picks a new timeframe', async () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        // The prefetch must be issued from the event handler, not during render:
        // useSuspenseQuery calling a Server Action mid-render collides with
        // Next's internal router state update.
        await waitFor(() => {
            expect(getBarsAction).toHaveBeenCalledWith(
                'AAPL',
                '1Week',
                undefined
            );
        });
        expect(mockReplace).toHaveBeenCalledWith(null, '', '/AAPL?tf=1Week');
        await waitFor(() => {
            expect(result.current.timeframeChangeCount).toBe(1);
        });
    });

    it('passes the resolved fmpSymbol into the prefetch query key', async () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            fmpSymbol: 'BTCUSD',
        } as ReturnType<typeof useAssetInfo>);

        const { result } = renderHook(
            () => useTimeframeChange('BTC', false, true),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        await waitFor(() => {
            expect(getBarsAction).toHaveBeenCalledWith(
                'BTC',
                '1Week',
                'BTCUSD'
            );
        });
    });

    it('applies a user pick without a URL notification and counts it once', async () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        // `replaceState`는 구독자에게 알려지지 않는다 — 화면은 로컬 선택이 바꾼다.
        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
        });
        // The pending-navigation ref absorbs the pick's own timeframe change so
        // the count stays at 1 — an extra increment would re-trigger the
        // analysis refresh for a change the user only made once.
        expect(result.current.timeframeChangeCount).toBe(1);
        expect(result.current.isTimeframeSwitching).toBe(false);
        expect(result.current.displayTimeframe).toBe('1Week');
    });

    describe('뒤로/앞으로 가기(popstate)', () => {
        /**
         * 사용자의 선택이 URL보다 우선하지만, 그 우선권을 popstate 뒤에도 유지하면 뒤로 가기가
         * 화면을 못 바꾼다(주소는 바뀌었는데 차트는 마지막 선택에 머문다).
         */
        it('사용자 선택 뒤 popstate가 오면 URL의 timeframe을 따른다', async () => {
            const { result } = renderHook(
                () => useTimeframeChange('AAPL', false, true),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.handleTimeframeChange('1Week' as Timeframe);
            });
            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Week');
            });

            popTo('tf=1Month');

            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Month');
            });
            expect(result.current.displayTimeframe).toBe('1Month');
        });

        it('popstate로 tf가 없는 항목에 오면 기본 timeframe으로 돌아간다', async () => {
            const { result } = renderHook(
                () => useTimeframeChange('AAPL', false, true),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.handleTimeframeChange('1Week' as Timeframe);
            });
            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Week');
            });

            popTo('');

            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Day');
            });
        });

        it('popstate 뒤에 다시 고르면 그 선택이 URL보다 우선한다', async () => {
            const { result } = renderHook(
                () => useTimeframeChange('AAPL', false, true),
                { wrapper: makeWrapper() }
            );

            popTo('tf=1Month');
            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Month');
            });

            act(() => {
                result.current.handleTimeframeChange('1Week' as Timeframe);
            });
            await waitFor(() => {
                expect(result.current.timeframe).toBe('1Week');
            });
        });
    });

    /**
     * pending을 "목적지에 도착했는가"(`pending.to === timeframe`)로만 풀면, 전환
     * 도중 timeframe이 그 목적지가 **아닌** 다른 값으로 강제로 바뀌는 경우(로그아웃
     * 등으로 tier가 free로 떨어져 DEFAULT_TIMEFRAME으로 강등)에 스피너가 영영
     * 풀리지 않는다. `from`(전환을 시작한 시점의 timeframe)과 달라졌는지로 풀어야
     * 이 경우도 잡는다.
     */
    it('tier가 free로 떨어지면 고른 timeframe 대신 DEFAULT로 강제되고 전환 표시가 풀린다', async () => {
        setUrl('tf=1Week');

        const { result, rerender } = renderHook(
            ({ isFreeTier }: { isFreeTier: boolean }) =>
                useTimeframeChange('AAPL', isFreeTier, true),
            {
                wrapper: makeWrapper(),
                initialProps: { isFreeTier: false },
            }
        );

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
        });

        act(() => {
            result.current.handleTimeframeChange('1Month' as Timeframe);
        });
        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Month');
        });

        // 로그아웃 등으로 free tier로 강등 — 선택(1Month)이 남아 있어도 DEFAULT로 강제된다.
        rerender({ isFreeTier: true });

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Day');
        });
        expect(result.current.isTimeframeSwitching).toBe(false);
        expect(result.current.displayTimeframe).toBe('1Day');
    });
});
