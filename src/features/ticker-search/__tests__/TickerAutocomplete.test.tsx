import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerAutocomplete } from '@/features/ticker-search/ui/TickerAutocomplete';
import { useAutocomplete } from '@/features/ticker-search/hooks/useAutocomplete';
import type { TickerSearchResult } from '@/shared/lib/types';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/ticker-search/hooks/useAutocomplete');
vi.mock('@/entities/ticker', () => ({
    isKoreanInput: vi.fn(() => false),
}));

const mockUseAutocomplete = vi.mocked(useAutocomplete);

const MOCK_RESULTS: TickerSearchResult[] = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ',
    },
    {
        symbol: 'AMZN',
        name: 'Amazon.com Inc.',
        koreanName: '아마존',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ',
    },
];

function setupAutocomplete(
    overrides: Partial<ReturnType<typeof useAutocomplete>> = {}
) {
    const defaults: ReturnType<typeof useAutocomplete> = {
        query: '',
        results: [],
        isSearching: false,
        selectedIndex: -1,
        isOpen: false,
        inputRef: { current: null },
        dropdownRef: { current: null },
        handleChange: vi.fn(),
        handleKeyDown: vi.fn(),
        handleFocus: vi.fn(),
        handleSearchClick: vi.fn(),
        navigate: vi.fn(),
        prefetch: vi.fn(),
    };
    mockUseAutocomplete.mockReturnValue({ ...defaults, ...overrides });
}

describe('TickerAutocomplete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders search input with combobox role', () => {
        setupAutocomplete();
        render(<TickerAutocomplete />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders search button', () => {
        setupAutocomplete();
        render(<TickerAutocomplete />);
        expect(
            screen.getByRole('button', { name: '검색' })
        ).toBeInTheDocument();
    });

    it('renders input with correct aria-label', () => {
        setupAutocomplete();
        render(<TickerAutocomplete />);
        expect(screen.getByLabelText('종목 티커 검색')).toBeInTheDocument();
    });

    it('does not show dropdown when closed', () => {
        setupAutocomplete({ isOpen: false });
        render(<TickerAutocomplete />);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows dropdown with results when open', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
        });
        render(<TickerAutocomplete />);
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('AMZN')).toBeInTheDocument();
    });

    it('shows searching indicator', () => {
        setupAutocomplete({ isOpen: true, isSearching: true });
        render(<TickerAutocomplete />);
        expect(screen.getByText('검색 중…')).toBeInTheDocument();
    });

    it('shows no results message', () => {
        setupAutocomplete({
            query: 'xyz',
            isOpen: true,
            isSearching: false,
            results: [],
        });
        render(<TickerAutocomplete />);
        expect(screen.getByText('검색 결과 없음')).toBeInTheDocument();
    });

    it('renders result items with option role', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
        });
        render(<TickerAutocomplete />);
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(2);
    });

    it('highlights selected result', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
            selectedIndex: 0,
        });
        render(<TickerAutocomplete />);
        const options = screen.getAllByRole('option');
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
        expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls handleSearchClick when search button is clicked', async () => {
        const handleSearchClick = vi.fn();
        setupAutocomplete({ handleSearchClick });
        const user = userEvent.setup();
        render(<TickerAutocomplete />);
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(handleSearchClick).toHaveBeenCalledTimes(1);
    });

    it('renders koreanName in result item display', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
        });
        render(<TickerAutocomplete />);
        expect(screen.getByText('Apple Inc. (애플)')).toBeInTheDocument();
    });

    it('renders exchange name', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
        });
        render(<TickerAutocomplete />);
        const nasdaqElements = screen.getAllByText('NASDAQ');
        expect(nasdaqElements.length).toBeGreaterThan(0);
    });

    it('sets aria-expanded based on isOpen', () => {
        setupAutocomplete({ isOpen: true });
        render(<TickerAutocomplete />);
        expect(screen.getByRole('combobox')).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });
});
