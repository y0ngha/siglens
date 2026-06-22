import { render, screen } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { ChartContent } from '@/widgets/symbol-page/ChartContent';

vi.mock('next/dynamic', () => ({
    default: (_loader: () => Promise<{ default: React.FC }>) => {
        const Component = (_props: Record<string, unknown>) => (
            <div data-testid="dynamic-component" />
        );
        Component.displayName = 'DynamicMock';
        return Component;
    },
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/widgets/chart', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));

// The mock renders one paragraph per `analysis.paragraphCount` so the scroll
// tests below can drive a genuinely long vs. short panel and assert where that
// content lands (inside the scroll container, not the chart column).
vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: ({
        analysis,
    }: {
        analysis?: { paragraphCount?: number };
    }) => (
        <div data-testid="analysis-panel">
            {Array.from({ length: analysis?.paragraphCount ?? 0 }, (_, i) => (
                <p data-testid="analysis-paragraph" key={i}>
                    분석 문단 {i}
                </p>
            ))}
        </div>
    ),
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked-notice" />,
}));

vi.mock('@/widgets/symbol-page/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 500 },
        ],
        indicators: { buySellVolume: [] },
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysis', () => ({
    useAnalysis: vi.fn(() => ({
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: vi.fn(() => ({
        clusteredKeyLevels: { support: [], resistance: [], poc: undefined },
        validatedActionPrices: undefined,
        reconciledActionLines: undefined,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: vi.fn(() => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: vi.fn(() => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    })),
}));

vi.mock('@/widgets/symbol-page/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-2.5-flash-lite',
        isHydrated: true,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/usePanelResize', () => ({
    usePanelResize: vi.fn(() => ({
        panelWidth: 640,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    })),
    PANEL_MIN_WIDTH: 240,
    PANEL_MAX_WIDTH: 640,
}));

vi.mock('@/widgets/symbol-page/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: vi.fn(() => ({
        phaseIndex: 0,
        tipIndex: 0,
    })),
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));

vi.mock('@/widgets/symbol-page/utils/buildChatState', () => ({
    buildChatState: vi.fn(() => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: false,
    })),
}));

vi.mock('@/shared/lib/pwaEvents', () => ({
    PWA_TRIGGER_EVENT: 'pwa-trigger',
}));

// Throw-capable so the ErrorBoundary fallback={null} path can be exercised.
const { mockFearGreedCard } = vi.hoisted(() => ({
    mockFearGreedCard: vi.fn(),
}));

vi.mock('@/widgets/symbol-page/FearGreedCardMounted', () => ({
    FearGreedCardMounted: () => mockFearGreedCard(),
}));

describe('ChartContent', () => {
    beforeEach(() => {
        mockFearGreedCard.mockImplementation(() => (
            <div data-testid="fear-greed-card" />
        ));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        timeframe: '1Day' as Timeframe,
        timeframeChangeCount: 0,
        initialAnalysis: {} as AnalysisResponse,
        initialAnalysisFailed: false,
        onMobileSheetContent: vi.fn(),
    };

    it('renders without crashing', () => {
        const { container } = render(<ChartContent {...defaultProps} />);
        expect(container.firstElementChild).toBeDefined();
    });

    it('swallows a thrown fear-greed card error via ErrorBoundary and still renders the chart', () => {
        // FearGreedCardMounted uses useSuspenseQuery; if its bars fetch throws
        // (the SSR failure mode #513 guards), the ErrorBoundary fallback={null}
        // must contain it so the chart shell keeps rendering.
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockFearGreedCard.mockImplementation(() => {
            throw new Error('bars fetch failed');
        });

        // try/finally so a failed assertion still restores the spy and doesn't
        // leak the console.error mock into sibling tests.
        try {
            const { container } = render(<ChartContent {...defaultProps} />);

            expect(screen.queryByTestId('fear-greed-card')).toBeNull();
            expect(container.firstElementChild).not.toBeNull();
            expect(screen.getByRole('separator')).toBeDefined();
            // ErrorBoundary가 에러를 잡으면 React가 console.error로 보고한다 —
            // 에러 경로가 실제로 실행됐음을 검증(테스트가 공허하게 통과하지 않도록).
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('renders the drag handle separator', () => {
        render(<ChartContent {...defaultProps} />);
        const separator = screen.getByRole('separator');
        expect(separator.getAttribute('aria-label')).toBe('패널 너비 조절');
    });

    it('renders the disclaimer text for equity (default)', () => {
        render(<ChartContent {...defaultProps} />);
        expect(
            screen.getByText(
                /차트는 Pre-market, After-market 주가를 반영하지 않습니다/
            )
        ).toBeDefined();
    });

    describe('Pre-market/After-market 면책 문구 — 자산군 게이팅', () => {
        it('equity(기본값)에서는 Pre-market/After-market 문구를 렌더한다', () => {
            render(
                <ChartContent {...defaultProps} marketProfile="us-equity" />
            );
            expect(
                screen.getByText(
                    /차트는 Pre-market, After-market 주가를 반영하지 않습니다/
                )
            ).toBeDefined();
        });

        it('crypto에서는 Pre-market/After-market 문구를 렌더하지 않는다', () => {
            // 암호화폐는 24/7 거래 — 장전/장후 세션이 없으므로 면책 문구가 사실과 다르다.
            render(<ChartContent {...defaultProps} marketProfile="crypto" />);
            expect(
                screen.queryByText(
                    /차트는 Pre-market, After-market 주가를 반영하지 않습니다/
                )
            ).toBeNull();
        });

        it('crypto에서도 시세 지연 안내는 그대로 렌더한다', () => {
            // FMP는 crypto도 동일하게 최대 15분 지연 데이터를 제공한다.
            render(<ChartContent {...defaultProps} marketProfile="crypto" />);
            expect(
                screen.getByText(/시세 데이터는 최대 15분 지연됩니다/)
            ).toBeDefined();
        });
    });

    it('renders analysis panel in aside', () => {
        render(<ChartContent {...defaultProps} />);
        expect(screen.getByTestId('analysis-panel')).toBeDefined();
    });

    it('keeps the facts layer and appends (does not replace with) the bot notice when bot is blocked and there is no narrative', async () => {
        const { useAnalysis } =
            await import('@/widgets/symbol-page/hooks/useAnalysis');
        const { useBars } = await import('@/widgets/symbol-page/hooks/useBars');
        // 사실 층이 실제로 렌더되려면 봉 2개 + rsi/macd 지표가 필요하다(buildTechnicalFacts는
        // 봉이 2개 미만이면 null). 파일 기본 useBars mock은 봉 1개라 facts가 null이 되므로
        // 이 테스트에 한해 2봉으로 override해 '교체가 아니라 병존'을 검증한다.
        (useBars as ReturnType<typeof vi.fn>).mockReturnValue({
            bars: [
                {
                    time: 0,
                    open: 100,
                    high: 120,
                    low: 90,
                    close: 100,
                    volume: 1,
                },
                {
                    time: 1,
                    open: 100,
                    high: 115,
                    low: 100,
                    close: 110,
                    volume: 1,
                },
            ],
            indicators: { rsi: [null, 55], macd: [], buySellVolume: [] },
        });
        // 서사 없음(FALLBACK) + 봇 차단 → 사실 층 분기. (참조 동등 FALLBACK이라야
        // hasNarrative=false가 되어 사실 층 분기를 탄다 — `{}`는 hasNarrative=true.)
        (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
            analysis: FALLBACK_ANALYSIS,
            analysisResult: null,
            isAnalyzing: false,
            analysisError: null,
            isBotBlocked: true,
            handleReanalyze: vi.fn(),
            reanalyzeCooldownMs: 0,
            cooldownNotice: null,
        });

        // try/finally: 앞선 어설션이 실패해도 후속 테스트로 mock(2봉/서사 없음)이
        // 누수되지 않게 파일 기본 mock(봉 1개 / 서사 있음) 복원을 보장한다. afterEach의
        // vi.clearAllMocks()는 vi.mock 팩토리가 vi.fn(() => ({...}))로 심은 기본 반환값을
        // 되돌리지 않으므로(그래서 resetAllMocks로 바꾸면 다른 테스트가 깨진다) 수동
        // 복원이 필요하고, 그 복원을 finally로 감싼다.
        try {
            render(<ChartContent {...defaultProps} />);
            // 봇 안내(additive)와 종목 고유 사실 층이 함께 존재 — 교체가 아니라 병존이다.
            // getByTestId/getByText는 부재 시 throw하므로 not.toBeNull로 존재를 명시 검증.
            expect(screen.getByTestId('bot-blocked-notice')).not.toBeNull();
            expect(screen.getByText(/기술적 지표 요약/)).not.toBeNull();
        } finally {
            (useBars as ReturnType<typeof vi.fn>).mockReturnValue({
                bars: [
                    {
                        time: 1,
                        open: 100,
                        high: 110,
                        low: 90,
                        close: 105,
                        volume: 500,
                    },
                ],
                indicators: { buySellVolume: [] },
            });
            (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
                analysis: {} as AnalysisResponse,
                analysisResult: null,
                isAnalyzing: false,
                analysisError: null,
                isBotBlocked: false,
                handleReanalyze: vi.fn(),
                reanalyzeCooldownMs: 0,
                cooldownNotice: null,
            });
        }
    });

    // "AI 분석이 길어지면 차트도 길어진다" 회귀 가드 — AI 분석 패널 스크롤 부분.
    //
    // jsdom에는 레이아웃 엔진이 없어 패널이 실제로 스크롤되는지 측정할 수 없다. 대신
    // 그 동작을 만드는 CSS 계약을 검증한다: 데스크톱 분석 패널(aside)은 md:h-full로 차트
    // 행 높이에 바운드되고 overflow-y-auto로 자체 스크롤하므로, 긴 분석이 행(=차트)을
    // 늘리지 못하고 패널 안에서만 스크롤된다. scrollbar-none으로 스크롤바는 감춰
    // 페이지 스크롤과 시각적으로 겹치지 않게 한다. 이 계약은 분석 길이와 무관하게
    // 유지되어야 한다 — 그 불변성이 회귀 가드다.
    describe('AI 분석 패널 스크롤', () => {
        // 패널을 길게/짧게 시뮬레이션하기 위한 문단 수. 입력값과 단언값에서 함께
        // 쓰이므로 이름 있는 상수로 묶어 한쪽만 바뀌는 drift를 막는다.
        const LONG_PARAGRAPH_COUNT = 80;
        const SHORT_PARAGRAPH_COUNT = 1;

        // 분석 문단 수를 주입해 긴/짧은 패널을 실제로 다르게 렌더한 뒤, 그 콘텐츠가
        // 차트 컬럼이 아니라 스크롤 컨테이너(aside) 안에 위치하는지 확인한다.
        const renderAsideWithParagraphs = async (paragraphCount: number) => {
            const { useAnalysis } =
                await import('@/widgets/symbol-page/hooks/useAnalysis');
            (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
                analysis: { paragraphCount } as unknown as AnalysisResponse,
                analysisResult: null,
                isAnalyzing: false,
                analysisError: null,
                isBotBlocked: false,
                handleReanalyze: vi.fn(),
                reanalyzeCooldownMs: 0,
                cooldownNotice: null,
            });
            const { container } = render(<ChartContent {...defaultProps} />);
            const aside = container.querySelector('aside');
            expect(aside).not.toBeNull();
            return aside as HTMLElement;
        };

        const paragraphsInside = (aside: HTMLElement) =>
            aside.querySelectorAll('[data-testid="analysis-paragraph"]').length;

        describe('AI 분석 패널이 길 때', () => {
            it('긴 분석이 aside(overflow-y-auto + md:h-full) 안에 담겨 패널 내부에서 스크롤되고 차트 행을 늘리지 않는다', async () => {
                const aside =
                    await renderAsideWithParagraphs(LONG_PARAGRAPH_COUNT);

                // 긴 콘텐츠가 스크롤 컨테이너(aside) 안에 위치 = 차트가 아니라 패널이 스크롤된다.
                expect(paragraphsInside(aside)).toBe(LONG_PARAGRAPH_COUNT);
                expect(aside.className).toContain('overflow-y-auto');
                expect(aside.className).toContain('md:h-full');
            });

            it('scrollbar-none으로 스크롤바를 감춰 페이지 스크롤과 겹쳐 보이지 않게 한다', async () => {
                const aside =
                    await renderAsideWithParagraphs(LONG_PARAGRAPH_COUNT);

                expect(aside.className).toContain('scrollbar-none');
            });
        });

        describe('AI 분석 패널이 짧을 때', () => {
            it('짧은 분석도 같은 aside 안에 담기며 overflow-y-auto + md:h-full + scrollbar-none 계약을 그대로 유지한다', async () => {
                const aside = await renderAsideWithParagraphs(
                    SHORT_PARAGRAPH_COUNT
                );

                expect(paragraphsInside(aside)).toBe(SHORT_PARAGRAPH_COUNT);
                expect(aside.className).toContain('overflow-y-auto');
                expect(aside.className).toContain('md:h-full');
                expect(aside.className).toContain('scrollbar-none');
            });
        });
    });
});
