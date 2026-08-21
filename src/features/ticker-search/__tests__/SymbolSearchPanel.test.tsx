import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/ticker-search/hooks/useRecentSearches');

/**
 * 오버레이 트리거는 provider가 있을 때만 렌더된다. provider 유무를 케이스마다
 * 바꿔야 해서 훅을 직접 갈아끼운다 — 실제 provider를 쓰면 라우터까지 따라온다.
 */
const overlayState: { value: { open: () => void } | null } = { value: null };
vi.mock('@/features/ticker-search/model/SearchOverlayContext', () => ({
    useSearchOverlayTrigger: () => overlayState.value,
}));

// TickerAutocomplete has deep dependencies; mock the entire component
vi.mock('@/features/ticker-search/ui/TickerAutocomplete', () => ({
    TickerAutocomplete: ({
        onSelect,
    }: {
        size?: string;
        onSelect?: (entry: { symbol: string; label: string }) => void;
    }) => (
        <div data-testid="ticker-autocomplete">
            {/* 실제 자동완성처럼 입력을 하나 둔다 — 데스크톱 폭에서 포커스가
                이쪽으로 복원되는지 확인해야 한다. */}
            <input data-testid="ticker-autocomplete-input" />
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

import { SEARCH_PLACEHOLDER_KEY } from '@/features/ticker-search/lib/searchLabels';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const SEARCH_PLACEHOLDER = catalogTranslator(
    'features.ticker-search',
    'ko'
)(SEARCH_PLACEHOLDER_KEY);

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
        overlayState.value = { open: vi.fn() };
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

    it('모바일에서는 최근 검색 칩을 4개까지만 드러낸다', () => {
        // 홈 첫 화면 세로가 귀하다. 상한은 오버레이와 같은 상수를 쓰며, 5번째부터는
        // 마크업은 두되 `hidden lg:inline-flex`로 감춘다(조건부 렌더는 하이드레이션
        // 불일치 여지를 만든다).
        setRecentEntries(
            Array.from({ length: 7 }, (_, i) => ({
                symbol: `SYM${i}`,
                label: `종목${i}`,
            }))
        );
        const { container } = render(<SymbolSearchPanel />);

        const chips = [...container.querySelectorAll('span')].filter(el =>
            el.className.includes('rounded-full')
        );
        const hidden = chips.filter(el => el.className.includes('hidden'));
        expect(chips).toHaveLength(7);
        expect(hidden).toHaveLength(3);
    });

    it('provider가 없으면 검색 트리거를 렌더하지 않는다', () => {
        // 눌러도 아무 일이 없는 컨트롤을 홈의 주 CTA 자리에 두지 않는다.
        // `HeaderSearch`와 같은 정책.
        overlayState.value = null;
        setRecentSearches([]);
        render(<SymbolSearchPanel />);

        expect(
            screen.queryByRole('button', { name: SEARCH_PLACEHOLDER })
        ).toBeNull();
    });

    it('모두 지우기 뒤 포커스가 검색 트리거로 돌아온다', async () => {
        // 이 버튼은 자기 자신이 든 행을 통째로 언마운트시킨다. 두면 포커스가
        // <body>로 떨어져 다음 Tab이 문서 처음부터 시작한다(WCAG 2.4.3).
        setRecentSearches(['AAPL']);
        render(<SymbolSearchPanel />);

        await userEvent.click(
            screen.getByRole('button', { name: '모두 지우기' })
        );

        expect(mockClearAll).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole('button', { name: SEARCH_PLACEHOLDER })
        ).toHaveFocus();
    });

    it('트리거가 숨겨진 폭(lg 이상)에서는 데스크톱 검색 입력으로 복원한다', async () => {
        // `lg`부터 돋보기 트리거는 `display:none`이다. 그 요소에 focus()를 주면
        // 조용히 실패해 포커스가 <body>로 떨어지므로, 그 폭에서 실제로 보이는
        // 검색 표면(인라인 자동완성)으로 보내야 한다.
        setRecentSearches(['AAPL']);
        render(<SymbolSearchPanel />);

        const trigger = screen.getByRole('button', {
            name: SEARCH_PLACEHOLDER,
        });
        trigger.style.display = 'none';

        await userEvent.click(
            screen.getByRole('button', { name: '모두 지우기' })
        );

        expect(screen.getByTestId('ticker-autocomplete-input')).toHaveFocus();
    });

    it('칩 하나를 지우면 포커스가 목록에 남는다', async () => {
        setRecentSearches(['AAPL', 'MSFT']);
        render(<SymbolSearchPanel />);

        await userEvent.click(
            screen.getByRole('button', { name: 'AAPL 최근 검색에서 제거' })
        );

        expect(mockRemoveSearch).toHaveBeenCalledWith('AAPL');
        expect(document.activeElement).not.toBe(document.body);
    });
});
