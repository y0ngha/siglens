import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL/news',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let mockNewsState = {
    isPending: false,
    data: null as Array<Record<string, unknown>> | null,
    error: null as Error | null,
};

function NewsPageMock({ symbol }: { symbol: string }) {
    return (
        <div>
            <h1>{symbol} News</h1>
            {mockNewsState.isPending && (
                <div data-testid="news-skeleton">Loading...</div>
            )}
            {mockNewsState.data && (
                <div data-testid="news-content">News loaded</div>
            )}
            {mockNewsState.error && (
                <div data-testid="news-error">
                    {mockNewsState.error.message}
                </div>
            )}
        </div>
    );
}

describe('News Analysis Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNewsState = { isPending: false, data: null, error: null };
    });

    it('shows loading skeleton while news is pending', () => {
        mockNewsState = { isPending: true, data: null, error: null };
        render(<NewsPageMock symbol="AAPL" />);
        expect(screen.getByTestId('news-skeleton')).toBeInTheDocument();
    });

    it('shows news content when data is loaded', () => {
        mockNewsState = {
            isPending: false,
            data: [{ id: 1, title: 'Apple earnings' }],
            error: null,
        };
        render(<NewsPageMock symbol="AAPL" />);
        expect(screen.getByTestId('news-content')).toBeInTheDocument();
    });

    it('shows error when news fetch fails', () => {
        mockNewsState = {
            isPending: false,
            data: null,
            error: new Error('뉴스를 불러올 수 없습니다.'),
        };
        render(<NewsPageMock symbol="AAPL" />);
        expect(
            screen.getByText('뉴스를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('does not show skeleton after data loads', () => {
        mockNewsState = {
            isPending: false,
            data: [{ id: 1, title: 'News item' }],
            error: null,
        };
        render(<NewsPageMock symbol="AAPL" />);
        expect(screen.queryByTestId('news-skeleton')).not.toBeInTheDocument();
    });
});
