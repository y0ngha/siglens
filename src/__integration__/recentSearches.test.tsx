import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/entities/ticker', () => ({
    isKoreanInput: vi.fn(() => false),
}));

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

let mockRecentSearches: string[] = [];
const mockAddSearch = vi.fn();
const mockRemoveSearch = vi.fn();
const mockClearAll = vi.fn();

vi.mock('@/features/ticker-search/hooks/useRecentSearches', () => ({
    useRecentSearches: () => ({
        recentSearches: mockRecentSearches,
        addSearch: mockAddSearch,
        removeSearch: mockRemoveSearch,
        clearAll: mockClearAll,
    }),
}));

vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: () => ({
        results: [],
        isSearching: false,
        hasQuery: false,
    }),
}));

describe('Recent Searches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecentSearches = [];
    });

    it('shows recent search chips when history exists', () => {
        mockRecentSearches = ['AAPL', 'TSLA', 'MSFT'];
        render(<SymbolSearchPanel />);
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('TSLA')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('최근 검색')).toBeInTheDocument();
    });

    it('does not show recents section when no history exists', () => {
        mockRecentSearches = [];
        render(<SymbolSearchPanel />);
        expect(screen.queryByText('최근 검색')).not.toBeInTheDocument();
    });

    it('calls removeSearch when delete button is clicked', async () => {
        mockRecentSearches = ['AAPL'];
        render(<SymbolSearchPanel />);
        const user = userEvent.setup();
        const deleteButton = screen.getByLabelText('AAPL 최근 검색에서 제거');
        await user.click(deleteButton);
        expect(mockRemoveSearch).toHaveBeenCalledWith('AAPL');
    });

    it('recent chip links to symbol page', () => {
        mockRecentSearches = ['NVDA'];
        render(<SymbolSearchPanel />);
        const link = screen.getByRole('link', { name: 'NVDA' });
        expect(link).toHaveAttribute('href', '/NVDA');
    });
});
