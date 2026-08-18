import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerAutocomplete } from '@/features/ticker-search/ui/TickerAutocomplete';
import { useAutocomplete } from '@/features/ticker-search/hooks/useAutocomplete';
import { isKoreanInput } from '@/entities/ticker';
import type { TickerSearchResult } from '@/shared/lib/types';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/ticker-search/hooks/useAutocomplete');
vi.mock('@/entities/ticker', () => ({
    isKoreanInput: vi.fn(() => false),
}));

const mockUseAutocomplete = vi.mocked(useAutocomplete);
const mockIsKoreanInput = vi.mocked(isKoreanInput);

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

    it('hides the search button in picker mode (navigateOnSelect=false)', () => {
        setupAutocomplete();
        render(<TickerAutocomplete navigateOnSelect={false} />);
        expect(
            screen.queryByRole('button', { name: '검색' })
        ).not.toBeInTheDocument();
    });

    it('회사명을 먼저, 티커를 뒤에 렌더한다', () => {
        // 사용자는 티커가 아니라 이름으로 종목을 떠올린다. 한국어 화면이므로 한글명이
        // 주 이름이고, 영문명은 다를 때만 보조로 붙는다.
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
        });
        render(<TickerAutocomplete />);

        expect(screen.getByText('애플')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();

        // 순서: 회사명 → 티커. DOM 순서로 확인한다.
        const option = screen.getByText('애플').closest('[role="option"]');
        expect(option).not.toBeNull();
        const text = option!.textContent ?? '';
        expect(text.indexOf('애플')).toBeLessThan(text.indexOf('AAPL'));
    });

    it('영문명이 한글명과 같으면 한 번만 쓴다', () => {
        // 종목 마스터 시드는 영문명을 주지 않아 `name`에 한글명을 넣는다 —
        // 그대로 두면 `삼성전자 (삼성전자)`가 된다.
        setupAutocomplete({
            query: '삼성',
            isOpen: true,
            results: [
                {
                    symbol: '005930.KS',
                    name: '삼성전자',
                    koreanName: '삼성전자',
                    exchange: 'KOSPI',
                    exchangeFullName: 'Korea Exchange (KOSPI)',
                },
            ],
        });
        render(<TickerAutocomplete />);

        expect(screen.getAllByText('삼성전자')).toHaveLength(1);
        expect(screen.getByText('005930.KS')).toBeInTheDocument();
    });

    it('국내 종목은 영문 법인명이 달라도 붙이지 않는다', () => {
        // 시드가 아니라 yahoo가 이름을 채운 국내 종목은 `name`이 영문 법인명이라
        // "한글명과 다르면 덧붙인다" 규칙에 그대로 걸린다. `buildDisplayName`과
        // `SymbolLayoutHeader`는 국내 종목에서 영문명을 빼는데 여기만 남으면
        // 자동완성과 이동한 페이지의 표기가 어긋난다.
        setupAutocomplete({
            query: '삼성',
            isOpen: true,
            results: [
                {
                    symbol: '005930.KS',
                    name: 'Samsung Electronics Co., Ltd.',
                    koreanName: '삼성전자',
                    exchange: 'KOSPI',
                    exchangeFullName: 'Korea Exchange (KOSPI)',
                },
            ],
        });
        render(<TickerAutocomplete />);

        expect(screen.getByText('삼성전자')).toBeInTheDocument();
        expect(
            screen.queryByText('Samsung Electronics Co., Ltd.')
        ).not.toBeInTheDocument();
    });

    it('미국 종목은 영문 법인명을 그대로 붙인다 — 억제는 국내 종목 한정이다', () => {
        setupAutocomplete({
            query: 'AAPL',
            isOpen: true,
            results: [MOCK_RESULTS[0]],
        });
        render(<TickerAutocomplete />);

        expect(screen.getByText('애플')).toBeInTheDocument();
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
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

    it('defaults to the generic aria-label when no ariaLabelledby is passed', () => {
        setupAutocomplete();
        render(<TickerAutocomplete />);
        expect(screen.getByRole('combobox')).toHaveAttribute(
            'aria-label',
            '종목 티커 검색'
        );
        expect(screen.getByRole('combobox')).not.toHaveAttribute(
            'aria-labelledby'
        );
    });

    it('uses ariaLabelledby instead of the default aria-label when a host form provides its own visible label', () => {
        setupAutocomplete();
        render(<TickerAutocomplete ariaLabelledby="host-symbol-label" />);
        const combobox = screen.getByRole('combobox');
        expect(combobox).toHaveAttribute(
            'aria-labelledby',
            'host-symbol-label'
        );
        expect(combobox).not.toHaveAttribute('aria-label');
    });

    it('renders the lg size variant', () => {
        setupAutocomplete();
        render(<TickerAutocomplete size="lg" />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '검색' })
        ).toBeInTheDocument();
    });

    it('shows the Korean-aware no-results hint when the query looks like Korean input', () => {
        mockIsKoreanInput.mockReturnValueOnce(true);
        setupAutocomplete({
            query: '애플',
            isOpen: true,
            isSearching: false,
            results: [],
        });
        render(<TickerAutocomplete />);
        expect(
            screen.getByText('검색 결과 없음 — 티커(예: AAPL)로 검색해 보세요')
        ).toBeInTheDocument();
    });

    it('omits the koreanName suffix in the result display when a result has no koreanName', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: [{ ...MOCK_RESULTS[0], koreanName: undefined }],
        });
        render(<TickerAutocomplete />);
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.queryByText(/\(애플\)/)).not.toBeInTheDocument();
    });

    it('renders the crypto badge for a crypto result', () => {
        setupAutocomplete({
            query: 'BTC',
            isOpen: true,
            results: [
                {
                    symbol: 'BTCUSD',
                    name: 'Bitcoin',
                    koreanName: '비트코인',
                    exchange: 'CRYPTO',
                    exchangeFullName: 'Crypto',
                    marketProfile: 'crypto',
                },
            ],
        });
        render(<TickerAutocomplete />);
        expect(screen.getByText('코인')).toBeInTheDocument();
    });

    it('selects a result on click and prefetches on hover', async () => {
        const user = userEvent.setup();
        const navigate = vi.fn();
        const prefetch = vi.fn();
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: MOCK_RESULTS,
            navigate,
            prefetch,
        });
        render(<TickerAutocomplete />);

        const [firstOption] = screen.getAllByRole('option');
        await user.hover(firstOption);
        expect(prefetch).toHaveBeenCalledWith('AAPL');

        await user.click(firstOption);
        expect(navigate).toHaveBeenCalledWith('AAPL');
    });
});
