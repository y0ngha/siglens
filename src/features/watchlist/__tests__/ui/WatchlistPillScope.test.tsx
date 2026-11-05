vi.mock('@/features/watchlist/hooks/useWatchlist');

import { render, renderHook, screen } from '@testing-library/react';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import {
    useWatchlistPill,
    WatchlistPillScope,
} from '@/features/watchlist/ui/WatchlistPillScope';
import { WatchlistPillToggle } from '@/features/watchlist/ui/WatchlistPillToggle';

type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
    const value: Watchlist = {
        items: [],
        has: symbol => symbol === 'MSFT',
        toggle: vi.fn(async () => 'added' as const),
        add: vi.fn(),
        remove: vi.fn(),
        isHydrated: true,
        isAtLimit: false,
        limit: 20,
        isMember: false,
        isIdentityPending: false,
        ...overrides,
    };
    vi.mocked(useWatchlist).mockReturnValue(value);
    return value;
}

describe('WatchlistPillScope', () => {
    it('알약이 여러 개여도 관심종목은 스코프에서 한 번만 구독한다', () => {
        setWatchlist();
        render(
            <WatchlistPillScope>
                <WatchlistPillToggle
                    symbol="AAPL"
                    label="애플"
                    source="home_popular"
                />
                <WatchlistPillToggle
                    symbol="MSFT"
                    label="마이크로소프트"
                    source="home_popular"
                />
                <WatchlistPillToggle
                    symbol="NVDA"
                    label="엔비디아"
                    source="home_popular"
                />
            </WatchlistPillScope>
        );
        expect(vi.mocked(useWatchlist)).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole('button', { name: '관심종목: 마이크로소프트' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('button', { name: '관심종목: 애플' })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('has·toggle·isHydrated가 그대로면 다른 값이 바뀌어도 알약에 넘기는 값이 그대로다', () => {
        const wl = setWatchlist();
        const seen: unknown[] = [];
        function Probe() {
            seen.push(useWatchlistPill());
            return null;
        }
        const { rerender } = render(
            <WatchlistPillScope>
                <Probe />
            </WatchlistPillScope>
        );
        vi.mocked(useWatchlist).mockReturnValue({
            ...wl,
            isAtLimit: true,
            limit: 5,
        });
        rerender(
            <WatchlistPillScope>
                <Probe />
            </WatchlistPillScope>
        );

        expect(seen).toHaveLength(2);
        expect(seen[1]).toBe(seen[0]);
    });

    it('isHydrated가 바뀌면 알약에 넘기는 값도 바뀐다', () => {
        const wl = setWatchlist({ isHydrated: false });
        const seen: unknown[] = [];
        function Probe() {
            seen.push(useWatchlistPill());
            return null;
        }
        const { rerender } = render(
            <WatchlistPillScope>
                <Probe />
            </WatchlistPillScope>
        );
        vi.mocked(useWatchlist).mockReturnValue({ ...wl, isHydrated: true });
        rerender(
            <WatchlistPillScope>
                <Probe />
            </WatchlistPillScope>
        );

        expect(seen[1]).not.toBe(seen[0]);
        expect(seen[1]).toMatchObject({ isHydrated: true });
    });

    it('스코프 밖에서 부르면 바로 알린다', () => {
        // React가 던진 렌더 오류를 콘솔에 남길 수 있어 이 테스트에서만 막는다.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() => useWatchlistPill());
        }).toThrow('useWatchlistPill must be used inside WatchlistPillScope');

        spy.mockRestore();
    });
});
