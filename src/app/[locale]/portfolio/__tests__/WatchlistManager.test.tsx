const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}));
let lastOnChange: (() => void) | undefined;
vi.mock('@/features/watchlist/ui/WatchlistSection', () => ({
    WatchlistSection: ({
        onHoldingsChange,
    }: {
        onHoldingsChange?: () => void;
    }) => {
        lastOnChange = onHoldingsChange;
        return <div data-testid="watchlist-section" />;
    },
}));

import { render, screen } from '@testing-library/react';
import { WatchlistManager } from '@/app/[locale]/portfolio/WatchlistManager';

describe('WatchlistManager', () => {
    it('WatchlistSection을 그리고 보유 변경 시 router.refresh를 1회 부른다', () => {
        render(<WatchlistManager />);
        expect(screen.getByTestId('watchlist-section')).toBeInTheDocument();
        lastOnChange?.();
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
});
