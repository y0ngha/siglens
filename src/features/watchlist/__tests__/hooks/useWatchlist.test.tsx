vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/getWatchlistAction', () => ({
    getWatchlistAction: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/addWatchlistItemAction', () => ({
    addWatchlistItemAction: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/removeWatchlistItemAction', () => ({
    removeWatchlistItemAction: vi.fn(),
}));
const identity = vi.hoisted(() => ({
    hasAuthHint: false,
    currentUser: null as { id: string } | null | undefined,
}));
vi.mock('@/entities/auth/hooks/useAuthHint', () => ({
    useAuthHint: () => identity.hasAuthHint,
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({
        data: identity.currentUser,
        isPending: identity.currentUser === undefined,
    }),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { getWatchlistAction } from '@/entities/watchlist/actions/getWatchlistAction';
import { addWatchlistItemAction } from '@/entities/watchlist/actions/addWatchlistItemAction';
import { removeWatchlistItemAction } from '@/entities/watchlist/actions/removeWatchlistItemAction';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import {
    WATCHLIST_MAX_LOCAL,
    WATCHLIST_MAX_MEMBER,
} from '@/shared/config/watchlist';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockGet = vi.mocked(getWatchlistAction);
const mockAdd = vi.mocked(addWatchlistItemAction);
const mockRemove = vi.mocked(removeWatchlistItemAction);
const mockTrack = vi.mocked(trackFunnelEvent);

describe('useWatchlist', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        identity.hasAuthHint = false;
        identity.currentUser = null;
        mockGet.mockResolvedValue([]);
    });

    describe('비회원(로컬)', () => {
        it('로컬에 담고, 서버 액션을 부르지 않으며, watchlist_added를 source와 함께 1회 보낸다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.limit).toBe(WATCHLIST_MAX_LOCAL);

            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'AAPL', label: '애플' },
                    'home_onboarding'
                );
            });
            expect(outcome).toBe('added');
            expect(result.current.has('aapl')).toBe(true);
            expect(result.current.items[0]).toMatchObject({
                symbol: 'AAPL',
                companyName: '애플',
            });
            expect(mockAdd).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockTrack).toHaveBeenCalledTimes(1);
            expect(mockTrack).toHaveBeenCalledWith('watchlist_added', {
                source: 'home_onboarding',
            });
        });

        it('add는 이미 담긴 종목을 빼지 않고 이벤트도 보내지 않는다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            await act(async () => {
                await result.current.add(
                    { symbol: 'AAPL', label: '애플' },
                    'nudge'
                );
            });
            mockTrack.mockClear();

            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.add(
                    { symbol: 'aapl', label: '애플' },
                    'nudge'
                );
            });

            expect(outcome).toBe('added');
            expect(result.current.has('AAPL')).toBe(true);
            expect(mockTrack).not.toHaveBeenCalled();
        });

        it('add는 없으면 담고 watchlist_added를 한 번 보낸다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));

            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.add(
                    { symbol: 'AAPL', label: '애플' },
                    'nudge'
                );
            });

            expect(outcome).toBe('added');
            expect(result.current.has('AAPL')).toBe(true);
            expect(mockTrack).toHaveBeenCalledTimes(1);
            expect(mockTrack).toHaveBeenCalledWith('watchlist_added', {
                source: 'nudge',
            });
        });

        it('저장소가 막혀 있으면 failed, 이벤트·성공 토스트 없음', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            const spy = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(() => {
                    throw new Error('blocked');
                });
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'AAPL', label: '애플' },
                    'symbol_header'
                );
            });
            spy.mockRestore();
            expect(outcome).toBe('failed');
            expect(mockTrack).not.toHaveBeenCalled();
            expect(result.current.has('AAPL')).toBe(false);
            expect(toast.showToast).toHaveBeenCalledTimes(1);
        });

        it('확정된 비회원은 getWatchlistAction을 부르지 않는다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.isIdentityPending).toBe(false);
            expect(result.current.isMember).toBe(false);
            await act(async () => {
                await Promise.resolve();
            });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('신원 확정 전에는 isIdentityPending=true이고 서버 조회도 하지 않는다', async () => {
            identity.currentUser = undefined;
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.isIdentityPending).toBe(true);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('같은 데이터로 리렌더해도 toggle·remove·has 참조가 유지된다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result, rerender } = renderHook(() => useWatchlist(), {
                wrapper,
            });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            const { toggle, remove, has } = result.current;
            rerender();
            expect(result.current.toggle).toBe(toggle);
            expect(result.current.remove).toBe(remove);
            expect(result.current.has).toBe(has);
        });

        it('다시 토글하면 빼고, 이벤트는 보내지 않는다', async () => {
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await act(async () => {
                await result.current.toggle(
                    { symbol: 'AAPL', label: '애플' },
                    'symbol_header'
                );
            });
            mockTrack.mockClear();
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'AAPL', label: '애플' },
                    'symbol_header'
                );
            });
            expect(outcome).toBe('removed');
            expect(result.current.items).toEqual([]);
            expect(mockTrack).not.toHaveBeenCalled();
        });

        it('상한이면 isAtLimit=true, toggle은 at_limit을 돌려주고 토스트를 띄운다', async () => {
            localStorage.setItem(
                LOCAL_STORAGE_WATCHLIST_KEY,
                JSON.stringify(
                    Array.from({ length: WATCHLIST_MAX_LOCAL }, (_, i) => ({
                        symbol: `S${i}`,
                        label: `S${i}`,
                        addedAt: i,
                    }))
                )
            );
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isAtLimit).toBe(true));
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'NEW', label: 'New' },
                    'home_onboarding'
                );
            });
            expect(outcome).toBe('at_limit');
            expect(toast.showToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining(
                        String(WATCHLIST_MAX_LOCAL)
                    ),
                })
            );
            expect(mockTrack).not.toHaveBeenCalled();
        });

        it('비회원 확정 전(힌트 없음·currentUser pending)에도 로컬에 쓴다', async () => {
            identity.currentUser = undefined;
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            await act(async () => {
                await result.current.toggle(
                    { symbol: 'AAPL', label: '애플' },
                    'symbol_header'
                );
            });
            expect(result.current.has('AAPL')).toBe(true);
            expect(mockAdd).not.toHaveBeenCalled();
        });
    });

    describe('회원(서버)', () => {
        beforeEach(() => {
            identity.hasAuthHint = true;
            identity.currentUser = { id: 'user-1' };
            mockGet.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    addedAt: '2026-10-01T00:00:00.000Z',
                },
            ]);
        });

        it('서버 목록을 보여 주고 로컬 저장값은 무시한다. 상한은 회원 값', async () => {
            localStorage.setItem(
                LOCAL_STORAGE_WATCHLIST_KEY,
                JSON.stringify([{ symbol: 'LOCAL', label: 'L', addedAt: 1 }])
            );
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            expect(result.current.isHydrated).toBe(false); // 목록 도착 전엔 토글 비활성
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            expect(result.current.items.map(i => i.symbol)).toEqual(['AAPL']);
            expect(result.current.limit).toBe(WATCHLIST_MAX_MEMBER);
        });

        it('담기는 서버 액션으로 가고 성공 시 이벤트를 1회 보낸다', async () => {
            mockAdd.mockResolvedValue({
                status: 'ok',
                item: {
                    symbol: 'MSFT',
                    companyName: 'Microsoft Corp.',
                    addedAt: '2026-10-09T00:00:00.000Z',
                },
                created: true,
            });
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'MSFT', label: 'MS' },
                    'portfolio_page'
                );
            });
            expect(outcome).toBe('added');
            expect(mockAdd).toHaveBeenCalledWith({
                symbol: 'MSFT',
                label: 'MS',
            });
            expect(mockTrack).toHaveBeenCalledTimes(1);
            expect(mockTrack).toHaveBeenCalledWith('watchlist_added', {
                source: 'portfolio_page',
            });
            expect(
                localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)
            ).toBeNull();
        });

        it('서버에 이미 있던 심볼(다른 탭에서 담음, created=false)이면 added로 끝나되 이벤트는 보내지 않는다', async () => {
            mockAdd.mockResolvedValue({
                status: 'ok',
                item: {
                    symbol: 'MSFT',
                    companyName: 'Microsoft Corp.',
                    addedAt: '2026-10-09T00:00:00.000Z',
                },
                created: false,
            });
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.add(
                    { symbol: 'MSFT', label: 'MS' },
                    'portfolio_page'
                );
            });
            expect(outcome).toBe('added');
            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockTrack).not.toHaveBeenCalled();
        });

        it('액션이 error 결과면 failed, 에러 토스트, 이벤트 없음', async () => {
            mockAdd.mockResolvedValue({
                status: 'error',
                code: 'limit_reached',
                message: '상한 초과',
            });
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'MSFT', label: 'MS' },
                    'symbol_header'
                );
            });
            expect(outcome).toBe('failed');
            expect(toast.showToast).toHaveBeenCalledWith({
                message: '상한 초과',
            });
            expect(mockTrack).not.toHaveBeenCalled();
            expect(result.current.has('MSFT')).toBe(false);
        });

        it('액션이 던지면 failed와 일반 에러 토스트', async () => {
            mockAdd.mockRejectedValue(new Error('network'));
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            let outcome: string | undefined;
            await act(async () => {
                outcome = await result.current.toggle(
                    { symbol: 'MSFT', label: 'MS' },
                    'symbol_header'
                );
            });
            expect(outcome).toBe('failed');
            expect(toast.showToast).toHaveBeenCalledTimes(1);
        });

        it('remove는 서버 액션으로 간다', async () => {
            mockRemove.mockResolvedValue({ status: 'ok' });
            const { wrapper } = createQueryClientWrapper();
            const { result } = renderHook(() => useWatchlist(), { wrapper });
            await waitFor(() => expect(result.current.isHydrated).toBe(true));
            let ok: boolean | undefined;
            await act(async () => {
                ok = await result.current.remove('AAPL');
            });
            expect(ok).toBe(true);
            expect(mockRemove).toHaveBeenCalledWith('AAPL');
        });
    });
});
