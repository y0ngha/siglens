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
vi.mock('@/entities/ticker', async importOriginal => ({
    // 부분 목 — 배지가 쓰는 `krExchangeOf` 같은 순수 함수까지 손으로 나열하면
    // 배럴에 export가 하나 늘 때마다 무관한 테스트가 죽는다.
    ...(await importOriginal<typeof import('@/entities/ticker')>()),
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

    /**
     * `삼성전자`는 KOSPI 주 상장과 미국 장외 비후원(SSNLF)으로 둘 다 잡힌다.
     * 배지가 없으면 목록에 같은 이름 두 줄이 뜨고 사용자는 구분할 수 없다.
     */
    it.each([
        ['005930.KS', 'Korea Exchange (KOSPI)', 'KOSPI'],
        ['247540.KQ', 'Korea Exchange (KOSDAQ)', 'KOSDAQ'],
        ['SSNLF', 'Other OTC', '미국 OTC'],
    ])('%s 는 %s 결과에 배지 "%s" 를 렌더한다', (symbol, full, badge) => {
        setupAutocomplete({
            query: '삼성',
            isOpen: true,
            results: [
                {
                    symbol,
                    name: 'Samsung Electronics Co., Ltd.',
                    koreanName: '삼성전자',
                    exchange: 'KRX',
                    exchangeFullName: full,
                },
            ],
        });
        render(<TickerAutocomplete />);
        expect(screen.getByText(badge)).toBeInTheDocument();
    });

    it('labels a plain US listing with its exchange', () => {
        // 배지를 국내·OTC에만 붙이면 "배지 없음"이 정보가 된다 — 배지 로직이
        // 조용히 깨져도 화면상 구분이 안 간다. 세 자산군 전부 명시한다.
        setupAutocomplete({ query: 'A', isOpen: true, results: MOCK_RESULTS });
        render(<TickerAutocomplete />);
        expect(screen.getAllByTestId('market-badge')[0]).toHaveTextContent(
            'NASDAQ'
        );
    });

    it('renders exactly one badge per result row', () => {
        setupAutocomplete({ query: 'A', isOpen: true, results: MOCK_RESULTS });
        render(<TickerAutocomplete />);
        expect(screen.getAllByTestId('market-badge')).toHaveLength(
            MOCK_RESULTS.length
        );
    });

    it('normalizes the exchange code and maps OTC pink sheets', () => {
        // 이 케이스가 없으면 `US_EXCHANGE_LABELS` 조회와 `.trim().toUpperCase()`가
        // 둘 다 지워져도 테스트가 통과한다 — 나머지 픽스처는 전부 크립토/KR/
        // exchangeFullName 분기로 빠져나가 이 줄에 닿지 않는다.
        setupAutocomplete({
            query: 'X',
            isOpen: true,
            results: [
                {
                    ...MOCK_RESULTS[0],
                    exchange: ' pnk ',
                    exchangeFullName: 'Pink Sheets',
                },
            ],
        });
        render(<TickerAutocomplete />);
        expect(screen.getByTestId('market-badge')).toHaveTextContent(
            '미국 OTC'
        );
    });

    it('renders no badge when the exchange is unknown', () => {
        setupAutocomplete({
            query: 'A',
            isOpen: true,
            results: [
                { ...MOCK_RESULTS[0], exchange: '', exchangeFullName: '' },
            ],
        });
        render(<TickerAutocomplete />);
        expect(screen.queryByTestId('market-badge')).not.toBeInTheDocument();
    });

    it('does not render a market badge for a crypto result on an OTC-named venue', () => {
        // 코인은 거래소 배지가 무의미하다 — `코인` 배지가 이미 자산군을 말한다.
        setupAutocomplete({
            query: 'BTC',
            isOpen: true,
            results: [
                {
                    symbol: 'BTCUSD',
                    name: 'Bitcoin',
                    exchange: 'CRYPTO',
                    exchangeFullName: 'OTC Crypto Desk',
                    marketProfile: 'crypto',
                },
            ],
        });
        render(<TickerAutocomplete />);
        const badges = screen.getAllByTestId('market-badge');
        expect(badges).toHaveLength(1);
        expect(badges[0]).toHaveTextContent('코인');
    });

    it('passes the display name alongside the symbol on select', () => {
        // 최근 검색이 `005930.KS`가 아니라 `삼성전자`로 남으려면 회사명이 함께
        // 넘어가야 한다.
        const navigate = vi.fn();
        setupAutocomplete({
            query: '삼성',
            isOpen: true,
            navigate,
            results: [
                {
                    symbol: '005930.KS',
                    name: 'Samsung Electronics Co., Ltd.',
                    koreanName: '삼성전자',
                    exchange: 'KRX',
                    exchangeFullName: 'Korea Exchange (KOSPI)',
                },
            ],
        });
        render(<TickerAutocomplete />);
        screen.getByRole('option').click();
        expect(navigate).toHaveBeenCalledWith('005930.KS', '삼성전자');
    });

    it('renders a placeholder covering all three asset classes', () => {
        setupAutocomplete();
        render(<TickerAutocomplete />);
        const placeholder =
            screen.getByRole('combobox').getAttribute('placeholder') ?? '';
        // 이름이 약속하는 대로 셋 다 확인한다 — 하나만 보면 나머지 둘이 조용히
        // 빠져도 통과한다. 한국 종목 예시는 **티커 코드**를 쓴다 — 한글 회사명
        // (`삼성전자`)은 번역되지 않아 중국어·일본어 UI에 그대로 남았다.
        for (const example of ['AAPL', '005930', 'BTC']) {
            expect(placeholder).toContain(example);
        }
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
        expect(navigate).toHaveBeenCalledWith('AAPL', expect.any(String));
    });
});
