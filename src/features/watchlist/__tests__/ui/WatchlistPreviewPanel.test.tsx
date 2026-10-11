vi.mock('@/features/watchlist/hooks/useWatchlistPreview', () => ({
    useWatchlistPreview: () => preview.value,
}));
vi.mock('@/features/watchlist/ui/MiniQuoteRow', () => ({
    MiniQuoteRow: ({ item }: { item: { symbol: string } }) => (
        <li>{item.symbol}</li>
    ),
}));
const preview = vi.hoisted(() => ({
    value: {
        watchlist: [] as { symbol: string; name: string }[],
        recent: [] as { symbol: string; name: string }[],
        isReady: true,
        defaultTab: 'watchlist' as const,
    },
}));

import { render, screen, within } from '@testing-library/react';
import { WATCHLIST_PREVIEW_COUNT } from '@/shared/config/watchlist';
import { WatchlistPreviewPanel } from '@/features/watchlist/ui/WatchlistPreviewPanel';

const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ symbol: `S${i}`, name: `S${i}` }));

describe('WatchlistPreviewPanel', () => {
    it('popover는 상한까지만, sheet는 전부 그리고 목록만 스크롤한다', () => {
        preview.value = {
            ...preview.value,
            watchlist: items(WATCHLIST_PREVIEW_COUNT + 3),
        };
        const { unmount } = render(
            <WatchlistPreviewPanel
                variant="popover"
                quotesEnabled
                onNavigate={vi.fn()}
            />
        );
        expect(
            within(screen.getByRole('list')).getAllByRole('listitem')
        ).toHaveLength(WATCHLIST_PREVIEW_COUNT);
        unmount();
        render(
            <WatchlistPreviewPanel
                variant="sheet"
                quotesEnabled
                onNavigate={vi.fn()}
            />
        );
        expect(
            within(screen.getByRole('list')).getAllByRole('listitem')
        ).toHaveLength(WATCHLIST_PREVIEW_COUNT + 3);
        expect(screen.getByRole('tabpanel')).toHaveClass(
            'overflow-y-auto',
            'flex-1'
        );
    });

    it('준비 전에는 로딩 상태를 알린다', () => {
        preview.value = { ...preview.value, isReady: false };
        render(
            <WatchlistPreviewPanel
                variant="sheet"
                quotesEnabled
                onNavigate={vi.fn()}
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            '관심종목을 불러오는 중이에요'
        );
    });
});
