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
        onSelect?: (entry: { symbol: string; label: string }) => void;
    }) => (
        <div data-testid="ticker-autocomplete">
            <button
                type="button"
                onClick={() => onSelect?.({ symbol: 'AAPL', label: '애플' })}
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

function setRecentEntries(entries: { symbol: string; label: string }[]) {
    mockUseRecentSearches.mockReturnValue({
        recentSearches: entries,
        addSearch: mockAddSearch,
        removeSearch: mockRemoveSearch,
        clearAll: mockClearAll,
    });
}

/**
 * 심볼 배열을 받아 엔트리로 승격시킨다 — 저장 단위가 `{ symbol, label }`로
 * 바뀌었지만(2026-08) 이 파일의 관심사는 칩 렌더·핸들러라 픽스처는 심볼만으로
 * 충분하다. 라벨을 따로 검증하는 케이스는 아래에 별도로 둔다.
 */
function setRecentSearches(searches: string[]) {
    setRecentEntries(searches.map(s => ({ symbol: s, label: s })));
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
            screen.getByRole('button', {
                name: 'AAPL 최근 검색에서 제거',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'MSFT 최근 검색에서 제거',
            })
        ).toBeInTheDocument();
    });

    it('calls removeSearch when remove button is clicked', async () => {
        setRecentSearches(['AAPL']);
        const user = userEvent.setup();
        render(<SymbolSearchPanel />);
        await user.click(
            screen.getByRole('button', {
                name: 'AAPL 최근 검색에서 제거',
            })
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
        // 최근 검색 칩을 다시 누르면 그 엔트리(심볼+라벨)를 그대로 넘긴다 —
        // 라벨을 잃으면 다음 렌더에서 회사명이 티커로 되돌아간다.
        expect(mockAddSearch).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: '애플',
        });
    });

    it('renders the company name on the chip, not the ticker', () => {
        // `005930.KS`는 사용자에게 의미가 없다. 이동에는 심볼을 쓰되 표시는 회사명.
        setRecentEntries([{ symbol: '005930.KS', label: '삼성전자' }]);
        render(<SymbolSearchPanel />);
        const link = screen.getByRole('link', { name: '삼성전자' });
        expect(link).toHaveAttribute('href', '/005930.KS');
        expect(screen.queryByText('005930.KS')).not.toBeInTheDocument();
        // 티커를 화면에서 뺐으니 hover/스크린리더에는 남겨야 한다 — 같은 회사의
        // KRX/OTC 칩 둘을 구분할 유일한 단서다.
        expect(link).toHaveAttribute('title', '005930.KS');
    });

    it('라벨이 심볼과 같으면 제거 버튼 이름에 괄호를 붙이지 않는다', () => {
        // `AAPL (AAPL)`은 스크린리더가 같은 말을 두 번 읽는다. 회사명을 모르는
        // 항목(옛 저장값·직접 입력)이 여기에 해당한다.
        setRecentEntries([{ symbol: 'AAPL', label: 'AAPL' }]);
        render(<SymbolSearchPanel />);
        expect(
            screen.getByRole('button', { name: 'AAPL 최근 검색에서 제거' })
        ).toBeInTheDocument();
    });

    it('re-adds the whole entry when a chip is clicked', () => {
        // 심볼만 넘기면 라벨이 심볼로 덮여, 칩을 한 번 누른 순간 `삼성전자`가
        // `005930.KS`로 되돌아간다.
        setRecentEntries([{ symbol: '005930.KS', label: '삼성전자' }]);
        render(<SymbolSearchPanel />);
        screen.getByRole('link', { name: '삼성전자' }).click();
        expect(mockAddSearch).toHaveBeenCalledWith({
            symbol: '005930.KS',
            label: '삼성전자',
        });
    });

    it('removes by symbol even when the chip shows a company name', () => {
        setRecentEntries([{ symbol: '005930.KS', label: '삼성전자' }]);
        render(<SymbolSearchPanel />);
        screen
            .getByRole('button', {
                name: '삼성전자 (005930.KS) 최근 검색에서 제거',
            })
            .click();
        expect(mockRemoveSearch).toHaveBeenCalledWith('005930.KS');
    });

    it('renders recent search items as links', () => {
        setRecentSearches(['AAPL']);
        render(<SymbolSearchPanel />);
        const link = screen.getByRole('link', { name: 'AAPL' });
        expect(link).toHaveAttribute('href', '/AAPL');
    });
});
