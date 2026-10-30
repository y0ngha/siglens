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
vi.mock('@/widgets/dashboard/ui/market-summary/MarketDataErrorNotice', () => ({
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
 * 목이 `href`·`currencySymbol`·`tickerIsReadable`을 DOM으로 흘려보낸다. 목이
 * `data`만 받으면 그것들을 삼켜, `linkSectorCards: false`가 무시돼도
 * (=한국 페이지가 KR 섹터 ETF로 가는 크롤 진입점 6개를 여는 회귀) 아무 테스트가
 * 안 깨진다. `tickerIsReadable`도 같다 — 삼키면 호출부를 `true` 리터럴로
 * 되돌려도(=한국 카드 제목이 다시 `091160.KS`가 되는 회귀) 전부 초록이다.
 */
vi.mock('@/widgets/dashboard/ui/market-summary/IndexCard', () => ({
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
}));

vi.mock('@/widgets/dashboard/ui/briefing/BriefingLoadingCard', () => ({
    BriefingLoadingCard: () => <div data-testid="briefing-loading" />,
}));

vi.mock('@/widgets/dashboard/ui/briefing/BriefingErrorCard', () => ({
    BriefingErrorCard: () => <div data-testid="briefing-error" />,
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
    isPending: false,
    isTotalFailure: false,
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
            isPending: true,
        });
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    /**
     * `DashboardScopeId`가 화면 없는 시장(`crypto`, 에이전트 도구 전용)까지 품게 되면서
     * 헤딩 키 표가 `Partial`이 됐다. 키가 없는 scope가 오면 scope 자신의 라벨로
     * 떨어지는데, 그 분기는 지금 어떤 페이지도 태우지 않는다 — 테스트가 없으면
     * 한 번도 실행되지 않은 채 남는다.
     */
    it('헤딩 키가 없는 scope는 scope 자신의 marketLabel을 제목으로 쓴다', () => {
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(
            <MarketSummaryPanel
                scope={{
                    ...TEST_SCOPE,
                    id: 'crypto',
                    hasHubPage: false,
                    marketLabel: 'Crypto market',
                }}
            />
        );
        expect(screen.getByText('Crypto market')).toBeInTheDocument();
        expect(screen.queryByText('오늘의 미국 시장')).not.toBeInTheDocument();
    });

    it('완전 실패(isTotalFailure) 시 데이터 로드 실패 안내만 표시한다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            isTotalFailure: true,
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
            isTotalFailure: true,
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
        // 한 번의 호출이 briefing 본문까지 싣고 온다.
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

    /**
     * 결과가 아직 없으면(서버 seed 없음) `null`이 아니라 자리를 잡은 로딩 카드를 그린다 —
     * 서버 HTML에도 나가므로 브리핑이 도착할 때 아래 섹터 패널이 밀리지 않는다.
     */
    it('briefing undefined면 BriefingRegion이 로딩 카드를 렌더한다', () => {
        mockUseMarketBriefing.mockReturnValue({ input: undefined });
        mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
        render(<MarketSummaryPanel scope={TEST_SCOPE} />);
        expect(screen.getByTestId('briefing-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('briefing')).not.toBeInTheDocument();
        expect(screen.queryByTestId('briefing-error')).not.toBeInTheDocument();
    });

    /**
     * 오류 카드(`role="alert"`)와 로딩 카드(`role="status"`)가 polite 라이브 영역 안에
     * 중첩되면 낭독이 경쟁한다 — 브리핑 영역은 카드 그리드의 라이브 영역 밖에 있어야 한다.
     */
    describe('라이브 영역 범위', () => {
        const SPY = {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            koreanName: 'S&P 500',
            displayName: 'S&P 500',
            price: 5000,
            changesPercentage: 1,
        };

        it('지수 카드는 polite 라이브 영역 안에 있다', () => {
            mockUseMarketSummary.mockReturnValue({
                ...defaultSummaryReturn,
                indices: [SPY],
            });
            render(<MarketSummaryPanel scope={TEST_SCOPE} />);
            expect(
                screen.getByTestId('index-SPY').closest('[aria-live="polite"]')
            ).not.toBeNull();
        });

        it.each([
            ['briefing-loading', undefined],
            ['briefing-error', 'error'],
        ] as const)(
            '%s 카드는 polite 라이브 영역 밖에 있다',
            (testId, input) => {
                mockUseMarketBriefing.mockReturnValue({ input });
                mockUseMarketSummary.mockReturnValue(defaultSummaryReturn);
                render(<MarketSummaryPanel scope={TEST_SCOPE} />);
                expect(screen.getByTestId(testId)).toBeInTheDocument();
                expect(
                    screen.getByTestId(testId).closest('[aria-live]')
                ).toBeNull();
            }
        );
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
        /* 3개짜리 섹터 그룹은 `sm` 이상에서 3열이 된다. */
        const grids = container.querySelectorAll('.sm\\:grid-cols-3');
        expect(grids.length).toBeGreaterThan(0);
        /* 모바일은 2열이어야 한다 — 3열이면 320px에서 카드가 눌려 가격이 잘린다. */
        grids.forEach(g => {
            expect(g.className.split(/\s+/)).toContain('grid-cols-2');
        });
    });
});

/**
 * `/market/kr`은 사이트맵 priority가 높다. 섹터 카드에 링크가 붙으면 그 페이지가
 * 인기 종목 목록에도 prewarm 회전에도 없는 KR ETF 6종으로 가는 **새 크롤 진입점**이
 * 되고, 봇이 캐시 미스에 분석 생성을 트리거해 비용이 튄다
 * (`dashboardScope.ts`의 `linkSectorCards` JSDoc 참고).
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
            isTotalFailure: true,
        });

        render(<MarketSummaryPanel scope={KR_SCOPE} />);

        const notice = screen.getByTestId('data-error-notice');
        expect(notice).toHaveAttribute('data-scope-id', 'kr');
        expect(notice).toHaveAttribute('data-variant', 'total');
    });

    /**
     * 기본 픽스처는 `indices: []`라 상단 지수 카드가 아예 안 그려진다 — 그 호출부만
     * 하드코딩으로 되돌려도 다른 단언이 전부 통과한다. 지수 카드를 실제로 그리게 해서
     * 그 경로도 고정한다.
     */
    it('상단 지수 카드에도 scope 값을 그대로 넘긴다', () => {
        mockUseMarketSummary.mockReturnValue({
            ...defaultSummaryReturn,
            indices: [
                {
                    symbol: 'KS11',
                    fmpSymbol: '^KS11',
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
    });

    /**
     * 지수 값은 통화가 아니라 포인트다. `KOSPI ₩6,869`·`S&P 500 $6,740`·`VIX $18.3`은
     * 틀린 표기다. 환율(`KRW=X`)·ETF는 통화 값이라 기호를 유지해야 한다 — 지수만 뺀다.
     */
    describe('지수 카드 가격 접두', () => {
        const quote = (symbol: string, fmpSymbol: string) => ({
            symbol,
            fmpSymbol,
            displayName: symbol,
            koreanName: symbol,
            price: 100,
            changesPercentage: 0.5,
        });

        const renderIndices = (
            scope: typeof TEST_SCOPE,
            indices: ReturnType<typeof quote>[]
        ) => {
            mockUseMarketSummary.mockReturnValue({
                ...defaultSummaryReturn,
                indices,
            });
            render(<MarketSummaryPanel scope={scope} />);
        };

        it('미국: ^GSPC·^VIX는 기호가 없고, 환율·ETF 풍의 비지수 심볼은 $를 유지한다', () => {
            renderIndices(TEST_SCOPE, [
                quote('GSPC', '^GSPC'),
                quote('VIX', '^VIX'),
                quote('SPY', 'SPY'),
            ]);

            expect(screen.getByTestId('index-GSPC')).toHaveAttribute(
                'data-currency',
                ''
            );
            expect(screen.getByTestId('index-VIX')).toHaveAttribute(
                'data-currency',
                ''
            );
            expect(screen.getByTestId('index-SPY')).toHaveAttribute(
                'data-currency',
                '$'
            );
        });

        it('한국: ^KS11·^KQ11은 기호가 없고, USDKRW(KRW=X)는 ₩를 유지한다', () => {
            renderIndices(KR_SCOPE, [
                quote('KS11', '^KS11'),
                quote('KQ11', '^KQ11'),
                quote('USDKRW', 'KRW=X'),
            ]);

            expect(screen.getByTestId('index-KS11')).toHaveAttribute(
                'data-currency',
                ''
            );
            expect(screen.getByTestId('index-KQ11')).toHaveAttribute(
                'data-currency',
                ''
            );
            expect(screen.getByTestId('index-USDKRW')).toHaveAttribute(
                'data-currency',
                '₩'
            );
        });
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
