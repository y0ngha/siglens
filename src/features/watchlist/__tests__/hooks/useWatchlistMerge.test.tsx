vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/mergeWatchlistAction', () => ({
    mergeWatchlistAction: vi.fn(),
}));
const identity = vi.hoisted(() => ({
    currentUser: undefined as { id: string } | null | undefined,
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({
        data: identity.currentUser,
        isPending: identity.currentUser === undefined,
    }),
}));
const route = vi.hoisted(() => ({ pathname: '/portfolio' }));
vi.mock('@/shared/i18n/useAppPathname', () => ({
    useAppPathname: () => route.pathname,
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useWatchlistMerge } from '@/features/watchlist/hooks/useWatchlistMerge';
import { mergeWatchlistAction } from '@/entities/watchlist/actions/mergeWatchlistAction';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import {
    LOCAL_STORAGE_WATCHLIST_KEY,
    SESSION_STORAGE_WATCHLIST_MERGED_KEY,
} from '@/shared/lib/storageKeys';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockMerge = vi.mocked(mergeWatchlistAction);
const mockTrack = vi.mocked(trackFunnelEvent);
const LOCAL = [
    { symbol: 'MSFT', label: 'MS', addedAt: 2 },
    { symbol: 'AAPL', label: '애플', addedAt: 1 },
];

describe('useWatchlistMerge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        identity.currentUser = undefined;
        route.pathname = '/portfolio';
        localStorage.setItem(
            LOCAL_STORAGE_WATCHLIST_KEY,
            JSON.stringify(LOCAL)
        );
    });

    it('회원 확정 전(pending)·비회원(null)에는 부르지 않는다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), { wrapper });
        identity.currentUser = null;
        rerender();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockMerge).not.toHaveBeenCalled();
    });

    it('로컬이 비어 있으면 부르지 않는다', async () => {
        localStorage.clear();
        identity.currentUser = { id: 'user-1' };
        const { wrapper } = createQueryClientWrapper();
        renderHook(() => useWatchlistMerge(), { wrapper });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockMerge).not.toHaveBeenCalled();
    });

    it('성공: 최근 순으로 넘기고, 로컬을 비우고, 세션 플래그를 쓰고, 쿼리를 무효화하고, 토스트·이벤트를 낸다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({ status: 'ok', added: 2, skipped: 0 });
        const { wrapper, client } = createQueryClientWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(() => useWatchlistMerge(), { wrapper });

        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        expect(mockMerge).toHaveBeenCalledWith([
            { symbol: 'MSFT', label: 'MS' },
            { symbol: 'AAPL', label: '애플' },
        ]);
        await waitFor(() =>
            expect(localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)).toBeNull()
        );
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBe('1');
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.watchlist(),
        });
        expect(toast.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                message: '관심종목 2개를 계정으로 가져왔어요',
                link: { href: '/portfolio', label: '내 종목 보기' },
            })
        );
        expect(toast.showToast).toHaveBeenCalledWith(
            expect.not.objectContaining({ detail: expect.any(String) })
        );
        expect(mockTrack).toHaveBeenCalledWith('watchlist_merged', {
            count: 2,
        });
    });

    it('skipped>0이면 토스트에 제외 안내 줄을 붙인다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({ status: 'ok', added: 1, skipped: 1 });
        const { wrapper } = createQueryClientWrapper();
        renderHook(() => useWatchlistMerge(), { wrapper });
        await waitFor(() => expect(toast.showToast).toHaveBeenCalled());
        expect(toast.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: `상한 ${WATCHLIST_MAX_MEMBER}개를 넘어 1개는 제외했어요`,
            })
        );
    });

    it('실패(error 결과): 로컬 유지, 플래그 없음, 토스트 없음 — 같은 페이지 로드에서는 재시도하지 않는다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({
            status: 'error',
            code: 'storage_unavailable',
            message: 'x',
        });
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), {
            wrapper,
        });
        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)
        ).not.toBeNull();
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBeNull();
        expect(toast.showToast).not.toHaveBeenCalled();

        route.pathname = '/AAPL';
        rerender();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockMerge).toHaveBeenCalledTimes(1);
    });

    it('미인증 응답도 재시도하지 않고 로컬을 유지한다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({
            status: 'error',
            code: 'unauthenticated',
            message: 'x',
        });
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), {
            wrapper,
        });
        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        rerender();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockMerge).toHaveBeenCalledTimes(1);
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)
        ).not.toBeNull();
    });

    it('액션이 reject되면 로컬 유지, 플래그·토스트 없음', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockRejectedValue(new Error('network'));
        const { wrapper } = createQueryClientWrapper();
        renderHook(() => useWatchlistMerge(), { wrapper });
        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)
        ).not.toBeNull();
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBeNull();
        expect(toast.showToast).not.toHaveBeenCalled();
        expect(mockTrack).not.toHaveBeenCalled();
    });

    it('진행 중에 다시 호출돼도 액션은 한 번만 부른다', async () => {
        identity.currentUser = { id: 'user-1' };
        let resolve!: (value: {
            status: 'ok';
            added: number;
            skipped: number;
        }) => void;
        mockMerge.mockReturnValue(
            new Promise(r => {
                resolve = r;
            })
        );
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), {
            wrapper,
        });
        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        act(() => {
            window.dispatchEvent(new Event('siglens:watchlist-change'));
        });
        rerender();
        expect(mockMerge).toHaveBeenCalledTimes(1);
        await act(async () => resolve({ status: 'ok', added: 2, skipped: 0 }));
        expect(mockMerge).toHaveBeenCalledTimes(1);
    });

    it('added=0: 로컬을 비우고 플래그를 쓰되 토스트·이벤트는 없다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({ status: 'ok', added: 0, skipped: 0 });
        const { wrapper, client } = createQueryClientWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(() => useWatchlistMerge(), { wrapper });
        await waitFor(() =>
            expect(localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)).toBeNull()
        );
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBe('1');
        expect(invalidate).toHaveBeenCalled();
        expect(toast.showToast).not.toHaveBeenCalled();
        expect(mockTrack).not.toHaveBeenCalled();
    });

    it('added=0 && skipped>0: 제외 안내 토스트만, 이벤트는 없다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({ status: 'ok', added: 0, skipped: 2 });
        const { wrapper } = createQueryClientWrapper();
        renderHook(() => useWatchlistMerge(), { wrapper });
        await waitFor(() => expect(toast.showToast).toHaveBeenCalledTimes(1));
        expect(toast.showToast).toHaveBeenCalledWith({
            message: `상한 ${WATCHLIST_MAX_MEMBER}개를 넘어 2개는 제외했어요`,
        });
        expect(mockTrack).not.toHaveBeenCalled();
    });

    it('병합 → 로그아웃 → 비회원으로 담기 → 다시 로그인하면 같은 탭에서도 한 번 더 병합한다', async () => {
        identity.currentUser = { id: 'user-1' };
        mockMerge.mockResolvedValue({ status: 'ok', added: 2, skipped: 0 });
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), {
            wrapper,
        });
        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(
                sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
            ).toBe('1')
        );

        identity.currentUser = null;
        rerender();
        await waitFor(() =>
            expect(
                sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
            ).toBeNull()
        );

        act(() => {
            localStorage.setItem(
                LOCAL_STORAGE_WATCHLIST_KEY,
                JSON.stringify([
                    { symbol: 'TSLA', label: '테슬라', addedAt: 3 },
                ])
            );
            window.dispatchEvent(new Event('siglens:watchlist-change'));
        });
        identity.currentUser = { id: 'user-1' };
        rerender();

        await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(2));
        expect(mockMerge).toHaveBeenLastCalledWith([
            { symbol: 'TSLA', label: '테슬라' },
        ]);
    });

    it('첫 응답 전(pending)에서 비회원(null)으로 확정돼도 세션 플래그를 지우지 않는다', async () => {
        sessionStorage.setItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY, '1');
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), { wrapper });
        identity.currentUser = null;
        rerender();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBe('1');
    });

    it('회원에서 null로 바뀌는 전이(로그아웃)는 세션 플래그를 지운다', async () => {
        sessionStorage.setItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY, '1');
        localStorage.clear();
        identity.currentUser = { id: 'user-1' };
        const { wrapper } = createQueryClientWrapper();
        const { rerender } = renderHook(() => useWatchlistMerge(), { wrapper });
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBe('1');
        identity.currentUser = null;
        rerender();
        await waitFor(() =>
            expect(
                sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
            ).toBeNull()
        );
    });

    it('이미 이 세션에 병합했으면 부르지 않는다', async () => {
        sessionStorage.setItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY, '1');
        identity.currentUser = { id: 'user-1' };
        const { wrapper } = createQueryClientWrapper();
        renderHook(() => useWatchlistMerge(), { wrapper });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockMerge).not.toHaveBeenCalled();
    });
});
