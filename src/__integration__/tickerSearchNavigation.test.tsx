import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerAutocomplete } from '@/features/ticker-search/ui/TickerAutocomplete';

const mockPush = vi.fn();
const mockPrefetch = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, prefetch: mockPrefetch }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/entities/ticker/actions/searchTickerAction', () => ({
    searchTickerAction: vi.fn().mockResolvedValue([
        {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select Market',
        },
        {
            symbol: 'AMZN',
            name: 'Amazon.com Inc.',
            koreanName: '아마존',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select Market',
        },
    ]),
}));

vi.mock('@/entities/ticker', () => ({
    isKoreanInput: vi.fn(() => false),
}));

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
}

function renderWithQuery(ui: React.ReactElement) {
    const qc = createQueryClient();
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Ticker Search -> Navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders combobox input with proper aria attributes', () => {
        renderWithQuery(<TickerAutocomplete />);
        const input = screen.getByRole('combobox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('aria-label', '종목 티커 검색');
        expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('renders search button that triggers navigation for typed query', async () => {
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        const input = screen.getByRole('combobox');
        await user.type(input, 'TSLA');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(mockPush).toHaveBeenCalledWith('/TSLA');
    });

    it('navigates when Enter is pressed with query text and no selection', async () => {
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        const input = screen.getByRole('combobox');
        await user.type(input, 'msft');
        await user.keyboard('{Enter}');
        expect(mockPush).toHaveBeenCalledWith('/MSFT');
    });

    it('Escape closes dropdown without navigation', async () => {
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        const input = screen.getByRole('combobox');
        await user.type(input, 'AA');
        await user.keyboard('{Escape}');
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('calls onSelect callback when provided', async () => {
        const onSelect = vi.fn();
        renderWithQuery(<TickerAutocomplete onSelect={onSelect} />);
        const user = userEvent.setup();
        await user.type(screen.getByRole('combobox'), 'NVDA');
        await user.click(screen.getByRole('button', { name: '검색' }));
        expect(onSelect).toHaveBeenCalledWith('NVDA');
    });
});
