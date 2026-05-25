import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/ticker-search/hooks/useRecentSearches');

// TickerAutocomplete has deep dependencies; mock the entire component
vi.mock('@/features/ticker-search/ui/TickerAutocomplete', () => ({
    TickerAutocomplete: ({
        onSelect,
    }: {
        size?: string;
        onSelect?: (symbol: string) => void;
    }) => (
        <div data-testid="ticker-autocomplete">
            <button
                type="button"
                onClick={() => onSelect?.('AAPL')}
                data-testid="mock-select"
            >
                select
            </button>
        </div>
    ),
}));

vi.mock('next/link', () => ({
    default: ({
        children,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a {...props}>{children}</a>,
}));

const mockUseRecentSearches = vi.mocked(useRecentSearches);
const mockAddSearch = vi.fn();
const mockRemoveSearch = vi.fn();
const mockClearAll = vi.fn();

function setRecentSearches(searches: string[]) {
    mockUseRecentSearches.mockReturnValue({
        recentSearches: searches,
        addSearch: mockAddSearch,
        removeSearch: mockRemoveSearch,
        clearAll: mockClearAll,
    });
}

describe('SymbolSearchPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders TickerAutocomplete', () => {
        setRecentSearches([]);
        render(<SymbolSearchPanel />);
        expect(screen.getByTestId('ticker-autocomplete')).toBeInTheDocument();
    });

    it('does not show recent searches when list is empty', () => {
        setRecentSearches([]);
        render(<SymbolSearchPanel />);
        expect(screen.queryByText('최근 검색')).not.toBeInTheDocument();
    });

    it('shows recent search chips when list is not empty', () => {
        setRecentSearches(['AAPL', 'MSFT']);
        render(<SymbolSearchPanel />);
        expect(screen.getByText('최근 검색')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
    });

    it('renders remove button for each recent search', () => {
        setRecentSearches(['AAPL', 'MSFT']);
        render(<SymbolSearchPanel />);
        expect(
            screen.getByRole('button', { name: 'AAPL 최근 검색에서 제거' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'MSFT 최근 검색에서 제거' })
        ).toBeInTheDocument();
    });

    it('calls removeSearch when remove button is clicked', async () => {
        setRecentSearches(['AAPL']);
        const user = userEvent.setup();
        render(<SymbolSearchPanel />);
        await user.click(
            screen.getByRole('button', { name: 'AAPL 최근 검색에서 제거' })
        );
        expect(mockRemoveSearch).toHaveBeenCalledWith('AAPL');
    });

    it('renders clear all button when recent searches exist', () => {
        setRecentSearches(['AAPL']);
        render(<SymbolSearchPanel />);
        expect(
            screen.getByRole('button', { name: '모두 지우기' })
        ).toBeInTheDocument();
    });

    it('calls clearAll when clear all button is clicked', async () => {
        setRecentSearches(['AAPL', 'MSFT']);
        const user = userEvent.setup();
        render(<SymbolSearchPanel />);
        await user.click(screen.getByRole('button', { name: '모두 지우기' }));
        expect(mockClearAll).toHaveBeenCalledTimes(1);
    });

    it('calls addSearch when TickerAutocomplete selects a ticker', async () => {
        setRecentSearches([]);
        const user = userEvent.setup();
        render(<SymbolSearchPanel />);
        await user.click(screen.getByTestId('mock-select'));
        expect(mockAddSearch).toHaveBeenCalledWith('AAPL');
    });

    it('renders recent search items as links', () => {
        setRecentSearches(['AAPL']);
        render(<SymbolSearchPanel />);
        const link = screen.getByRole('link', { name: 'AAPL' });
        expect(link).toHaveAttribute('href', '/AAPL');
    });
});
