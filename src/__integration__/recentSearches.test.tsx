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

interface RecentEntry {
    symbol: string;
    label: string;
}

/** 최근 검색 저장 단위는 `{ symbol, label }`이다 — 칩에는 티커가 아니라 회사명이 뜬다. */
function entries(...pairs: [string, string][]): RecentEntry[] {
    return pairs.map(([symbol, label]) => ({ symbol, label }));
}

let mockRecentSearches: RecentEntry[] = [];
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
        mockRecentSearches = entries(
            ['AAPL', '애플'],
            ['TSLA', '테슬라'],
            ['005930.KS', '삼성전자']
        );
        render(<SymbolSearchPanel />);
        expect(screen.getByText('애플')).toBeInTheDocument();
        expect(screen.getByText('테슬라')).toBeInTheDocument();
        expect(screen.getByText('삼성전자')).toBeInTheDocument();
        expect(screen.getByText('최근 검색')).toBeInTheDocument();
    });

    it('does not show recents section when no history exists', () => {
        mockRecentSearches = [];
        render(<SymbolSearchPanel />);
        expect(screen.queryByText('최근 검색')).not.toBeInTheDocument();
    });

    it('calls removeSearch when delete button is clicked', async () => {
        mockRecentSearches = entries(['005930.KS', '삼성전자']);
        render(<SymbolSearchPanel />);
        const user = userEvent.setup();
        const deleteButton = screen.getByLabelText(
            '삼성전자 (005930.KS) 최근 검색에서 제거'
        );
        await user.click(deleteButton);
        // 라벨로 지우면 저장소에 남는다 — 제거 키는 항상 심볼이어야 한다.
        expect(mockRemoveSearch).toHaveBeenCalledWith('005930.KS');
    });

    it('recent chip links to symbol page', () => {
        mockRecentSearches = entries(['NVDA', '엔비디아']);
        render(<SymbolSearchPanel />);
        const link = screen.getByRole('link', { name: '엔비디아' });
        expect(link).toHaveAttribute('href', '/NVDA');
    });
});
