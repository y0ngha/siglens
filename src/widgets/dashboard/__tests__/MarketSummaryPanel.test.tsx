import { fireEvent, render, screen } from '@testing-library/react';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';
import { TEST_SCOPE } from './helpers/testScope';

const mockUseMarketSummary = vi.fn();
vi.mock('@/widgets/dashboard/hooks/useMarketSummary', () => ({
    useMarketSummary: () => mockUseMarketSummary(),
}));

const mockUseMarketBriefing = vi.fn();
vi.mock('@/widgets/dashboard/hooks/useMarketBriefing', () => ({
    useMarketBriefing: () => mockUseMarketBriefing(),
}));

/*
 * 목이 `variant`·`marketLabel`을 DOM으로 흘려보낸다. 삼키면 전체 실패 분기가
 * `variant="partial"`로 되돌아가도(=아무것도 못 불러온 화면이 "일부를 가져오지
 * 못했어요"라고 말하는 회귀) 아무 테스트가 안 깨진다 — `IndexCard` 목과 같은
 * 이유다.
 */
vi.mock('@/widgets/dashboard/MarketDataErrorNotice', () => ({
    MarketDataErrorNotice: ({
        variant,
        scopeId,
        onClose,
    }: {
        variant: string;
        scopeId: string;
        onClose: () => void;
    }) => (
        <div
            data-testid="data-error-notice"
            data-variant={variant}
            data-scope-id={scopeId}
        >
            <button onClick={onClose}>close-notice</button>
        </div>
    ),
}));

vi.mock('@/widgets/dashboard/MarketSummaryPanelSkeleton', () => ({
    MarketSummaryPanelSkeleton: () => (
        <div data-testid="skeleton">Loading...</div>
    ),
}));

/*
 * 목이 `href`·`currencySymbol`·`tickerIsReadable`을 DOM으로 흘려보낸다. 예전 목은
 * `data`만 받아 그것들을 삼켰는데, 그러면 `linkSectorCards: false`가 무시돼도
 * (=한국 페이지가 KR 섹터 ETF로 가는 크롤 진입점 6개를 여는 회귀) 아무 테스트가
 * 안 깨진다. `tickerIsReadable`도 같다 — 삼키면 호출부를 `true` 리터럴로
 * 되돌려도(=한국 카드 제목이 다시 `091160.KS`가 되는 회귀) 전부 초록이다.
 */
vi.mock('@/widgets/dashboard/IndexCard', () => ({
    IndexCard: ({
        data,
        href,
        currencySymbol,
        tickerIsReadable,
    }: {
        data: { symbol: string };
        href?: string;
        currencySymbol: string;
        tickerIsReadable: boolean;
    }) => (
        <div
            data-testid={`index-${data.symbol}`}
            data-href={href ?? ''}
            data-currency={currencySymbol}
            data-ticker-readable={String(tickerIsReadable)}
        >
            {data.symbol}
        </div>
    ),
}));

vi.mock('@/widgets/dashboard/BriefingCard', () => ({
    BriefingCard: () => <div data-testid="briefing">Briefing</div>,
    BriefingLoadingCard: () => <div data-testid="briefing-loading" />,
    BriefingErrorCard: () => <div data-testid="briefing-error" />,
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));

const defaultSummaryReturn = {
    data: { summary: { indices: [], sectors: [] } },
    isPending: false,
    sectorMap: new Map(),
    indices: [],
    hasMissingQuotes: false,
};

const defaultBriefingReturn = { input: undefined };

describe('MarketSummaryPanel', () => {
    beforeEach(() => {
        mockUseMarketBriefing.mockReturnValue(defaultBriefingReturn);
    });

    afterEach(() => {
        mockUseMarketSummary.mockReset();
        mockUseMarketBriefing.mockReset();
    });

    it('renders skeleton while pending', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            data: undefined,
            isPending: true,
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('완전 실패(ok:false) 시 데이터 로드 실패 안내만 표시한다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            data: { ok: false },
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        const notice = screen.getByTestId('data-error-notice');
        expect(notice).toBeInTheDocument();
        // 카드도 제목도 없는 화면이므로 "일부"가 아니라 전체 실패 문구여야 한다.
        expect(notice).toHaveAttribute('data-variant', 'total');
        expect(notice).toHaveAttribute('data-scope-id', 'us');
        expect(screen.queryByText('오늘의 미국 시장')).not.toBeInTheDocument();
    });

    it('완전 실패 안내를 닫으면 아무것도 렌더하지 않는다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            data: { ok: false },
        });
        const { container } = render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        fireEvent.click(screen.getByText('close-notice'));
        expect(container.innerHTML).toBe('');
    });

    it('부분 실패(hasMissingQuotes) 시 안내와 지수 카드를 함께 표시한다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'SPY',
                    fmpSymbol: '^GSPC',
                    koreanName: 'S&P 500',
                    displayName: 'S&P 500',
                    price: 5000,
                    changesPercentage: 1,
                },
            ],
            hasMissingQuotes: true,
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        const notice = screen.getByTestId('data-error-notice');
        expect(notice).toBeInTheDocument();
        expect(notice).toHaveAttribute('data-variant', 'partial');
        expect(screen.getByText('오늘의 미국 시장')).toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('부분 실패 안내를 닫으면 안내만 사라지고 카드는 유지된다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'SPY',
                    fmpSymbol: '^GSPC',
                    koreanName: 'S&P 500',
                    displayName: 'S&P 500',
                    price: 5000,
                    changesPercentage: 1,
                },
            ],
            hasMissingQuotes: true,
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        fireEvent.click(screen.getByText('close-notice'));
        expect(
            screen.queryByTestId('data-error-notice')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('정상 데이터(hasMissingQuotes=false)면 안내를 표시하지 않는다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'SPY',
                    fmpSymbol: '^GSPC',
                    koreanName: 'S&P 500',
                    displayName: 'S&P 500',
                    price: 5000,
                    changesPercentage: 1,
                },
            ],
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(
            screen.queryByTestId('data-error-notice')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('renders indices and section heading when data is loaded', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'SPY',
                    fmpSymbol: '^GSPC',
                    koreanName: 'S&P 500',
                    displayName: 'S&P 500',
                    price: 5000,
                    changesPercentage: 1,
                },
            ],
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByText('오늘의 미국 시장')).toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('renders sector groups with ETF cards', () => {
        const sectorMap = new Map([
            [
                'XLK',
                {
                    symbol: 'XLK',
                    koreanName: 'IT',
                    displayName: 'Technology Select',
                    price: 200,
                    changesPercentage: 0.5,
                },
            ],
            [
                'XLF',
                {
                    symbol: 'XLF',
                    koreanName: '금융',
                    displayName: 'Financial Select',
                    price: 40,
                    changesPercentage: -0.3,
                },
            ],
            [
                'XLV',
                {
                    symbol: 'XLV',
                    koreanName: '헬스케어',
                    displayName: 'Health Care Select',
                    price: 140,
                    changesPercentage: 0.1,
                },
            ],
            [
                'XLI',
                {
                    symbol: 'XLI',
                    koreanName: '산업재',
                    displayName: 'Industrial Select',
                    price: 110,
                    changesPercentage: 0.2,
                },
            ],
        ]);

        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            sectorMap,
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByText('Tech')).toBeInTheDocument();
        expect(screen.getByText('Finance')).toBeInTheDocument();
        expect(screen.getByTestId('index-XLK')).toBeInTheDocument();
        expect(screen.getByTestId('index-XLF')).toBeInTheDocument();
    });

    it('briefing/generatedAt이 없는 상태(miss_no_trigger 등)에서는 방어적으로 로딩 카드를 렌더한다', () => {
        mockUseMarketBriefing.mockReturnValue({
            input: { status: 'miss_no_trigger' },
        });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('briefing-loading')).toBeInTheDocument();
    });

    it('done 상태면 브리핑 카드를 렌더한다', () => {
        // 구 구조에서는 submitted(jobId) → 별도 폴링 훅이 done을 받아왔지만,
        // 이제 한 번의 호출이 briefing 본문까지 싣고 온다.
        mockUseMarketBriefing.mockReturnValue({
            input: {
                status: 'done',
                briefing: 'AI briefing text',
                generatedAt: '2025-01-01T00:00:00Z',
            },
        });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('briefing')).toBeInTheDocument();
    });

    it('renders cached briefing when briefing status is cached', () => {
        mockUseMarketBriefing.mockReturnValue({
            input: {
                status: 'cached',
                briefing: 'AI briefing text',
                generatedAt: '2025-01-01T00:00:00Z',
            },
        });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('briefing')).toBeInTheDocument();
    });

    it('briefing undefined면 BriefingRegion이 아무것도 렌더하지 않는다', () => {
        mockUseMarketBriefing.mockReturnValue({ input: undefined });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.queryByTestId('briefing')).not.toBeInTheDocument();
        expect(screen.queryByTestId('bot-blocked')).not.toBeInTheDocument();
    });

    it('briefing null이면 봇 차단 안내를 렌더한다', () => {
        mockUseMarketBriefing.mockReturnValue({ input: null });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('grid-cols-3 when sector group has 3 items', () => {
        const sectorMap = new Map([
            [
                'XLF',
                {
                    symbol: 'XLF',
                    koreanName: '금융',
                    displayName: 'Financial',
                    price: 40,
                    changesPercentage: 0,
                },
            ],
            [
                'XLV',
                {
                    symbol: 'XLV',
                    koreanName: '헬스케어',
                    displayName: 'Health',
                    price: 140,
                    changesPercentage: 0,
                },
            ],
            [
                'XLI',
                {
                    symbol: 'XLI',
                    koreanName: '산업재',
                    displayName: 'Industrial',
                    price: 110,
                    changesPercentage: 0,
                },
            ],
        ]);

        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            sectorMap,
        });
        const { container } = render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        const grids = container.querySelectorAll('.grid-cols-3');
        expect(grids.length).toBeGreaterThan(0);
    });
});

/**
 * `/market/kr`은 사이트맵 priority 0.9다. 섹터 카드에 링크가 붙으면 그 페이지가
 * `POPULAR_TICKERS`에도 prewarm 회전에도 없는 KR ETF 6종으로 가는 **새 크롤
 * 진입점**이 된다 — 봇은 캐시 미스에 분석을 큐에 넣지 않으므로 딱 thin 변형만
 * 보게 되고, 그게 2026-07 노출 급감의 메커니즘이다.
 */
describe('MarketSummaryPanel — KR scope', () => {
    /** 첫 섹터 그룹의 심볼 하나만 채운 sectorMap — 카드 하나면 계약 검증에 충분하다. */
    const firstSectorSymbol = TEST_SCOPE.sectorGroups[0]!.symbols[0]!;

    beforeEach(() => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            sectorMap: new Map([
                [
                    firstSectorSymbol,
                    {
                        symbol: firstSectorSymbol,
                        sectorName: 'Technology',
                        koreanName: '기술',
                        price: 100,
                        changesPercentage: 1,
                    },
                ],
            ]),
        });
        mockUseMarketBriefing.mockReturnValue(defaultBriefingReturn);
    });

    afterEach(() => {
        mockUseMarketSummary.mockReset();
        mockUseMarketBriefing.mockReset();
    });

    const KR_SCOPE = {
        ...TEST_SCOPE,
        id: 'kr' as const,
        // TEST_SCOPE에서 퍼오면 `'미국 증시'`가 그대로 따라온다 — 그러면 한국
        // 화면이 미국 문구를 그려도 단언이 통과한다.
        marketLabel: '한국 증시',
        currencySymbol: '₩',
        linkSectorCards: false,
        // KRX 티커는 `091160.KS`처럼 읽어서 뜻이 통하지 않는다. 퍼온 `true`를
        // 그대로 두면 한국 카드 제목이 숫자로 돌아가도 단언이 통과한다.
        tickerIsReadable: false,
    };

    function sectorCards(container: HTMLElement): HTMLElement[] {
        return Array.from(
            container.querySelectorAll<HTMLElement>('[data-testid^="index-"]')
        );
    }

    /**
     * 문구를 `'미국 증시'`로 박아 두면 한국 화면이 미국 얘기를 한다. 미국 scope로만
     * 단언하면 그 회귀가 안 잡힌다 — `TEST_SCOPE.marketLabel`이 마침 `'미국 증시'`라
     * 하드코딩과 구분되지 않기 때문이다.
     */
    it('실패 안내에 이 시장의 이름을 넘긴다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            data: { ok: false },
        });

        render(<MarketSummaryPanel scope={KR_SCOPE} />);

        const notice = screen.getByTestId('data-error-notice');
        expect(notice).toHaveAttribute('data-scope-id', 'kr');
        expect(notice).toHaveAttribute('data-variant', 'total');
    });

    /**
     * 기본 픽스처는 `indices: []`라 상단 지수 카드가 아예 안 그려진다 — 그 호출부만
     * 하드코딩으로 되돌려도 다른 단언이 전부 통과한다(변이 검증에서 실제로 빠져나갔다).
     * 지수 카드를 실제로 그리게 해서 그 경로도 고정한다.
     */
    it('상단 지수 카드에도 scope 값을 그대로 넘긴다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'KS11',
                    fmpSymbol: 'KS11',
                    displayName: 'KOSPI',
                    koreanName: '코스피',
                    price: 6869.83,
                    changesPercentage: -1.55,
                },
            ],
        });

        render(<MarketSummaryPanel scope={KR_SCOPE} />);

        const card = screen.getByTestId('index-KS11');
        expect(card).toHaveAttribute('data-ticker-readable', 'false');
        expect(card).toHaveAttribute('data-currency', '₩');
    });

    it('섹터 카드에 링크를 붙이지 않고 통화 기호를 ₩로 넘긴다', () => {
        const { container } = render(<MarketSummaryPanel scope={KR_SCOPE} />);

        const cards = sectorCards(container);
        expect(cards.length).toBeGreaterThan(0);
        for (const card of cards) {
            expect(card).toHaveAttribute('data-href', '');
            expect(card).toHaveAttribute('data-currency', '₩');
            expect(card).toHaveAttribute('data-ticker-readable', 'false');
        }
    });

    it('미국 scope는 섹터 카드를 종목 페이지로 링크한다', () => {
        const { container } = render(<MarketSummaryPanel scope={TEST_SCOPE} />);

        const linked = sectorCards(container).filter(
            el => el.getAttribute('data-href') !== ''
        );
        expect(linked.length).toBeGreaterThan(0);
        expect(linked[0]).toHaveAttribute('data-currency', '$');
        expect(linked[0]).toHaveAttribute('data-ticker-readable', 'true');
    });
});
