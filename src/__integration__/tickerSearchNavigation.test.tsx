import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

/**
 * 질의에 반응하는 목이다. 예전에는 무슨 질의에나 AAPL/AMZN을 돌려줬는데, 그러면
 * "결과가 없을 때 친 문자열로 간다"는 경로를 이 파일에서 영영 밟을 수 없다 —
 * 검색 키의 목적지는 결과 유무로 갈리기 때문이다.
 */
const CATALOG = [
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
];

vi.mock('@/entities/ticker/actions/searchTickerAction', () => ({
    searchTickerAction: vi.fn(async (query: string) => {
        const needle = query.trim().toLowerCase();
        return CATALOG.filter(
            t =>
                t.symbol.toLowerCase().startsWith(needle) ||
                t.name.toLowerCase().startsWith(needle)
        );
    }),
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
        // 카탈로그에 없는 티커다. 결과가 비어 있음이 **확인된 뒤** 친 문자열로 간다 —
        // 검색 키를 누른 시점에는 아직 디바운스(300ms)가 끝나지 않았으므로 이동은
        // 한 박자 뒤에 일어난다.
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        const input = screen.getByRole('combobox');
        await user.type(input, 'TSLA');
        await user.click(screen.getByRole('button', { name: '검색' }));
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/TSLA'));
    });

    it('검색 키는 결과가 있으면 첫 결과로 간다', async () => {
        // 엔진이 아는 게 있으면 그 판단을 따른다. `appl`을 치고 검색 키를 눌렀을 때
        // `/APPL`(404)이 아니라 AAPL로 가야 한다 — 이 규칙이 없던 시절의 버그다.
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        await user.type(screen.getByRole('combobox'), 'appl');
        await user.click(screen.getByRole('button', { name: '검색' }));
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/AAPL'));
        expect(mockPush).not.toHaveBeenCalledWith('/APPL');
    });

    it('navigates when Enter is pressed with query text and no selection', async () => {
        renderWithQuery(<TickerAutocomplete />);
        const user = userEvent.setup();
        const input = screen.getByRole('combobox');
        await user.type(input, 'msft');
        await user.keyboard('{Enter}');
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/MSFT'));
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
        // 결과 선택이 아니라 직접 입력한 문자열이므로 라벨은 그 문자열 자체다.
        await waitFor(() =>
            expect(onSelect).toHaveBeenCalledWith({
                symbol: 'NVDA',
                label: 'NVDA',
            })
        );
    });
});
