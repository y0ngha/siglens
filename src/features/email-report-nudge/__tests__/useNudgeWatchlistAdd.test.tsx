const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

const watchlist = vi.hoisted(() => ({
    items: [] as Array<{ symbol: string }>,
    hydrated: true,
    identityPending: false,
    add: vi.fn(),
}));
vi.mock('@/features/watchlist/hooks/useWatchlist', () => ({
    useWatchlist: () => ({
        has: (symbol: string) => watchlist.items.some(i => i.symbol === symbol),
        add: watchlist.add,
        isHydrated: watchlist.hydrated,
        isIdentityPending: watchlist.identityPending,
    }),
}));

import { act, renderHook } from '@testing-library/react';
import { useNudgeWatchlistAdd } from '@/features/email-report-nudge/hooks/useNudgeWatchlistAdd';

describe('useNudgeWatchlistAdd', () => {
    beforeEach(() => {
        track.mockReset();
        watchlist.items = [];
        watchlist.hydrated = true;
        watchlist.identityPending = false;
        watchlist.add.mockReset();
        watchlist.add.mockResolvedValue('added');
    });

    it('심볼을 라벨로 nudge 출처에서 담는다', async () => {
        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        await act(() => result.current.add());

        expect(watchlist.add).toHaveBeenCalledWith(
            { symbol: 'NVDA', label: 'NVDA' },
            'nudge'
        );
    });

    it('담기 클릭을 퍼널에 남긴다', async () => {
        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        await act(() => result.current.add());

        expect(track).toHaveBeenCalledWith('nudge_clicked', {
            kind: 'member_symbol',
            cta: 'add',
        });
    });

    it('진행 중에는 isPending이고 다시 불러도 한 번만 담는다', async () => {
        watchlist.add.mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        act(() => {
            void result.current.add();
            void result.current.add();
        });

        expect([
            result.current.isPending,
            watchlist.add.mock.calls.length,
        ]).toEqual([true, 1]);
    });

    it('add가 던져도 진행 상태를 푼다', async () => {
        watchlist.add.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        await act(() => result.current.add());

        expect(result.current.isPending).toBe(false);
    });

    it.each([
        ['하이드레이션 전', () => (watchlist.hydrated = false)],
        ['회원 여부 미확정', () => (watchlist.identityPending = true)],
    ])('관심종목이 %s이면 담지 않는다', async (_, arrange) => {
        arrange();
        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        await act(() => result.current.add());

        expect([
            result.current.canAdd,
            watchlist.add.mock.calls.length,
        ]).toEqual([false, 0]);
    });

    it('added는 관심종목에 실제로 있는지를 따른다', () => {
        watchlist.items = [{ symbol: 'NVDA' }];

        const { result } = renderHook(() => useNudgeWatchlistAdd('NVDA'));

        expect(result.current.added).toBe(true);
    });

    it('입력이 같으면 add 참조가 유지된다', () => {
        const { result, rerender } = renderHook(() =>
            useNudgeWatchlistAdd('NVDA')
        );
        const first = result.current.add;

        rerender();

        expect(result.current.add).toBe(first);
    });
});
