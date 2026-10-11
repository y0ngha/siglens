vi.mock('@/features/watchlist/hooks/useWatchlist');

import { renderHook } from '@testing-library/react';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useWatchlistPreview } from '@/features/watchlist/hooks/useWatchlistPreview';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(overrides: Partial<Watchlist>) {
    vi.mocked(useWatchlist).mockReturnValue({
        items: [],
        has: () => false,
        toggle: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isMember: false,
        isIdentityPending: false,
        ...overrides,
    });
}

const AAPL = {
    symbol: 'AAPL',
    companyName: '애플',
    addedAt: '2026-10-11T00:00:00.000Z',
};

describe('useWatchlistPreview', () => {
    beforeEach(() => localStorage.clear());

    it('하이드레이션 전이거나 회원 여부를 모르는 빈 목록이면 준비되지 않았다', () => {
        setWatchlist({ isHydrated: false });
        expect(
            renderHook(() => useWatchlistPreview()).result.current.isReady
        ).toBe(false);
        setWatchlist({ isIdentityPending: true });
        expect(
            renderHook(() => useWatchlistPreview()).result.current.isReady
        ).toBe(false);
    });

    it('저장된 이름을 쓰고, 이름이 없으면 심볼이다', () => {
        setWatchlist({
            items: [AAPL, { ...AAPL, symbol: 'ZZZQ', companyName: null }],
        });
        const { result } = renderHook(() => useWatchlistPreview());
        expect(result.current.watchlist).toEqual([
            { symbol: 'AAPL', name: '애플' },
            { symbol: 'ZZZQ', name: 'ZZZQ' },
        ]);
        expect(result.current.defaultTab).toBe('watchlist');
    });

    it('담은 게 없고 최근 본 종목이 있으면 기본 탭은 최근 본이다', () => {
        setWatchlist({});
        localStorage.setItem(
            LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
            JSON.stringify([{ symbol: 'NVDA', label: '엔비디아', viewedAt: 1 }])
        );
        const { result } = renderHook(() => useWatchlistPreview());
        expect(result.current.recent).toEqual([
            { symbol: 'NVDA', name: '엔비디아' },
        ]);
        expect(result.current.defaultTab).toBe('recent');
    });

    it('둘 다 비었으면 기본 탭은 관심이다', () => {
        setWatchlist({});
        expect(
            renderHook(() => useWatchlistPreview()).result.current.defaultTab
        ).toBe('watchlist');
    });
});
