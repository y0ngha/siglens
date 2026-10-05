import { act, render, screen, waitFor } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '@/views/symbol/ChartContent';
import { useBars } from '@/entities/bars/hooks/useBars';
import { __resetStoredChartPreferencesCacheForTests } from '@/widgets/chart/hooks/useHasStoredChartPreferences';
import {
    HUMAN_INTERACTION_STORAGE_KEY,
    __resetHumanInteractionForTests,
    markHumanInteracted,
} from '@/shared/lib/humanInteractionStore';

// 폴백은 이제 로케일별 빌더다 — 예전 `FALLBACK_ANALYSIS` 상수는 한국어 요약을
// 들고 있어 `/en/AAPL`이 영어 화면에 한국어 폴백을 렌더했다.
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

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

vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
}));
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
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
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
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

vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 500 },
        ],
        indicators: { buySellVolume: [] },
    })),
}));

vi.mock('@/views/symbol/hooks/useAnalysis', () => ({
    useAnalysis: vi.fn(() => ({
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        isAnalyzing: false,
        analysisError: null,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
    })),
}));

vi.mock('@/views/symbol/hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: vi.fn(() => ({
        clusteredKeyLevels: { support: [], resistance: [], poc: undefined },
        validatedActionPrices: undefined,
        reconciledActionLines: undefined,
    })),
}));

vi.mock('@/views/symbol/hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: vi.fn(() => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    })),
}));

const { mockOpenSignupNudge } = vi.hoisted(() => ({
    mockOpenSignupNudge: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-3.5-flash-lite',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudge: mockOpenSignupNudge,
    })),
}));

const { mockUseAnonAnalysisNudge } = vi.hoisted(() => ({
    // isLoginResolved: true by default — most tests here exercise the
    // post-resolve path. The real hook only ever calls onSymbolAnalyzed's
    // effective branch once this is true (see ChartContent's gating on it).
    // The modal open-state is no longer owned by this hook: crossing the
    // threshold calls the provider's shared opener, so the hook returns just
    // the resolution flag + the per-symbol notifier.
    mockUseAnonAnalysisNudge: vi.fn(() => ({
        isLoginResolved: true,
        onSymbolAnalyzed: vi.fn(),
    })),
}));

vi.mock('@/features/analysis-nudge/hooks/useAnonAnalysisNudge', () => ({
    useAnonAnalysisNudge: mockUseAnonAnalysisNudge,
}));

vi.mock('@/views/symbol/SymbolPageContext', () => ({
    useSymbolPageContext: vi.fn(() => ({ indicatorCount: 25 })),
}));

vi.mock('@/views/symbol/hooks/usePanelResize', () => ({
    usePanelResize: vi.fn(() => ({
        panelWidth: 640,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    })),
    PANEL_MIN_WIDTH: 240,
    PANEL_MAX_WIDTH: 640,
}));

vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: vi.fn(() => ({
        phaseIndex: 0,
        tipIndex: 0,
    })),
}));

// "내 포지션" 요약(PositionStatusSummary)의 소스. 실제 구현은 react-query 기반이라
// QueryClientProvider 없는 이 테스트 트리에서 그대로 렌더하면 크래시한다. 이
// 파일의 관심사(ChartContent 레이아웃/분석 상태)와 무관하므로 "홀딩 없음"으로
// 고정한 no-op 목으로 대체한다 — PositionStatusSummary는 마운트되지 않는다.
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding', () => ({
    useSymbolHolding: vi.fn(() => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    })),
}));

describe('ChartContent', () => {
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

    it('does not render a fear-greed card in the analysis panel', () => {
        // 공포·탐욕 지표는 헤더 칩과 전용 페이지에만 노출한다 — 기술적 분석
        // 패널(차트 사이드)에서는 제거됐다. 회귀 방지용 단언.
        render(<ChartContent {...defaultProps} />);
        expect(screen.queryByTestId('fear-greed-card')).toBeNull();
    });

    describe('seed 복원 재조회 게이트 (useBars refetchEnabled)', () => {
        /** `useBars` 목이 **마지막으로** 받은 옵션 — 호출 인덱스가 아니라 최신 렌더 기준이다. */
        function lastRefetchEnabled(): boolean | undefined {
            const calls = vi.mocked(useBars).mock.calls;
            return calls[calls.length - 1]?.[0].refetchEnabled;
        }

        beforeEach(() => {
            __resetHumanInteractionForTests();
            window.sessionStorage.removeItem(HUMAN_INTERACTION_STORAGE_KEY);
            window.localStorage.clear();
            __resetStoredChartPreferencesCacheForTests();
        });

        afterEach(() => {
            __resetHumanInteractionForTests();
            window.sessionStorage.removeItem(HUMAN_INTERACTION_STORAGE_KEY);
            window.localStorage.clear();
            __resetStoredChartPreferencesCacheForTests();
        });

        // 장 마감 중(토요일)과 정규장 중(수요일 15:00 UTC = 11:00 ET)의 고정 시각.
        const MARKET_CLOSED_AT = new Date('2026-10-03T15:00:00Z');
        const MARKET_OPEN_AT = new Date('2026-10-07T15:00:00Z');

        /** `Date`만 고정한다 — 타이머를 가짜로 바꾸면 RTL의 `waitFor`가 멈춘다. */
        function setNow(now: Date): void {
            vi.useFakeTimers({ toFake: ['Date'], now });
        }

        afterEach(() => {
            vi.useRealTimers();
        });

        it('seed가 완전하고(장 마감 중 생성) 지금도 장 마감이면 입력 전까지 재조회를 미룬다 (크롤러·첫 방문)', () => {
            setNow(MARKET_CLOSED_AT);
            render(
                <ChartContent
                    {...defaultProps}
                    seedHasFormingBarTrimmed={false}
                />
            );
            expect(lastRefetchEnabled()).toBe(false);
        });

        it('seed가 형성 중 봉을 뺀 채 만들어졌으면(장중 생성) 지금 장 마감이어도 입력 없이 연다', () => {
            setNow(MARKET_CLOSED_AT);
            render(
                <ChartContent
                    {...defaultProps}
                    seedHasFormingBarTrimmed={true}
                />
            );
            expect(lastRefetchEnabled()).toBe(true);
        });

        it('지금 정규장 중이면 seed가 완전해도 입력 없이 연다 (장 마감 중 만든 ISR을 장중에 본 경우)', () => {
            setNow(MARKET_OPEN_AT);
            render(
                <ChartContent
                    {...defaultProps}
                    seedHasFormingBarTrimmed={false}
                />
            );
            expect(lastRefetchEnabled()).toBe(true);
        });

        it('크립토는 24/7이라 형성 중 봉이 항상 있다 — 입력 없이 연다', () => {
            setNow(MARKET_CLOSED_AT);
            render(
                <ChartContent
                    {...defaultProps}
                    symbol="BTCUSD"
                    marketProfile="crypto"
                    seedHasFormingBarTrimmed={false}
                />
            );
            expect(lastRefetchEnabled()).toBe(true);
        });

        it('prop을 생략하면 옛 동작대로 연다', () => {
            setNow(MARKET_CLOSED_AT);
            render(<ChartContent {...defaultProps} />);
            expect(lastRefetchEnabled()).toBe(true);
        });

        it('사람 입력이 있으면 재조회를 연다', async () => {
            setNow(MARKET_CLOSED_AT);
            render(
                <ChartContent
                    {...defaultProps}
                    seedHasFormingBarTrimmed={false}
                />
            );
            expect(lastRefetchEnabled()).toBe(false);
            act(() => markHumanInteracted());
            await waitFor(() => expect(lastRefetchEnabled()).toBe(true));
        });

        it('저장된 차트 설정이 있는 재방문자는 입력 전에도 연다 (첫 페인트부터 전체 지표가 필요)', () => {
            setNow(MARKET_CLOSED_AT);
            window.localStorage.setItem(
                'siglens.chart.overlay.bollinger',
                'true'
            );
            render(
                <ChartContent
                    {...defaultProps}
                    seedHasFormingBarTrimmed={false}
                />
            );
            expect(lastRefetchEnabled()).toBe(true);
        });
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
    });

    describe('시세 지연 안내 — 시장 프로파일의 quoteDelayMinutes를 따른다', () => {
        it('국내 종목은 20분 지연이라고 말한다', () => {
            render(
                <ChartContent {...defaultProps} marketProfile="kr-equity" />
            );
            expect(
                screen.getByText(/시세 데이터는 약 20분 지연됩니다/)
            ).toBeDefined();
            expect(screen.queryByText(/최대 15분/)).toBeNull();
        });

        it.each(['us-equity', 'crypto'] as const)(
            '%s는 실시간이라 지연 문구 대신 기준 시점을 말한다',
            marketProfile => {
                render(
                    <ChartContent
                        {...defaultProps}
                        marketProfile={marketProfile}
                    />
                );
                expect(
                    screen.getByText(/시세는 페이지를 불러온 시점 기준이에요/)
                ).toBeDefined();
                expect(screen.queryByText(/지연됩니다/)).toBeNull();
            }
        );
    });

    it('renders analysis panel in aside', () => {
        render(<ChartContent {...defaultProps} />);
        expect(screen.getByTestId('analysis-panel')).toBeDefined();
    });

    describe('anonymous signup nudge (member-reasoning-toggle spec Part B)', () => {
        it('does not render the signup-nudge modal itself — the provider owns the single instance', () => {
            render(<ChartContent {...defaultProps} />);
            // ChartContent no longer imports/renders AnalysisSignupNudgeModal;
            // the one instance lives in SymbolModelProvider. No dialog here.
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('notifies onSymbolAnalyzed with the symbol when a real (non-fallback) narrative renders', async () => {
            const onSymbolAnalyzed = vi.fn();
            mockUseAnonAnalysisNudge.mockReturnValueOnce({
                isLoginResolved: true,
                onSymbolAnalyzed,
            });
            // default useAnalysis mock returns `analysis: {}` — not the
            // FALLBACK_ANALYSIS reference, so isFallbackAnalysis() is false.
            render(<ChartContent {...defaultProps} />);
            await waitFor(() => {
                expect(onSymbolAnalyzed).toHaveBeenCalledWith('AAPL');
            });
        });

        it('does not notify onSymbolAnalyzed while the analysis is still the FALLBACK_ANALYSIS shell', async () => {
            const { useAnalysis } =
                await import('@/views/symbol/hooks/useAnalysis');
            const onSymbolAnalyzed = vi.fn();
            mockUseAnonAnalysisNudge.mockReturnValueOnce({
                isLoginResolved: true,
                onSymbolAnalyzed,
            });
            (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValueOnce({
                analysis: FALLBACK_ANALYSIS,
                analysisResult: null,
                isAnalyzing: true,
                analysisError: null,
                handleReanalyze: vi.fn(),
                reanalyzeCooldownMs: 0,
                cooldownNotice: null,
            });

            render(<ChartContent {...defaultProps} />);

            expect(onSymbolAnalyzed).not.toHaveBeenCalled();
        });
    });

    // "AI 분석이 길어지면 차트도 길어진다" + "패널이 차트와 동떨어진다" 회귀 가드.
    //
    // jsdom에는 레이아웃 엔진이 없어 실제 픽셀을 측정할 수 없다. 대신 그 동작을
    // 만드는 CSS 계약을 검증한다(연혁은 ChartContent의 aside 주석 참고):
    //
    //   - 차트 컬럼이 `--symbol-chart-h`로 **자기 높이를 확정**한다. 분석 길이와
    //     무관하게 고정되는 지점이 여기다.
    //   - aside도 같은 `--symbol-chart-h`로 높이를 확정하고 `overflow-y-auto`로
    //     자체 스크롤한다. 긴 분석이 패널을 차트 아래로 늘리지 않는다.
    //   - 스크롤러는 aside 하나뿐이다(jail·`<main>` 같은 추가 중첩 스크롤러 금지).
    describe('AI 패널 내부 스크롤 + 차트 높이 고정', () => {
        // 패널을 길게/짧게 시뮬레이션하기 위한 문단 수. 입력값과 단언값에서 함께
        // 쓰이므로 이름 있는 상수로 묶어 한쪽만 바뀌는 drift를 막는다.
        const LONG_PARAGRAPH_COUNT = 80;
        const SHORT_PARAGRAPH_COUNT = 1;

        /** 차트·패널 높이를 확정하는 CSS 변수를 참조하는 Tailwind 클래스. */
        const CHART_HEIGHT = 'md:h-(--symbol-chart-h)';

        const renderWithParagraphs = async (paragraphCount: number) => {
            const { useAnalysis } =
                await import('@/views/symbol/hooks/useAnalysis');
            (useAnalysis as ReturnType<typeof vi.fn>).mockReturnValue({
                analysis: { paragraphCount } as unknown as AnalysisResponse,
                analysisResult: null,
                isAnalyzing: false,
                analysisError: null,
                handleReanalyze: vi.fn(),
                reanalyzeCooldownMs: 0,
                cooldownNotice: null,
            });
            return render(<ChartContent {...defaultProps} />).container;
        };

        const asideOf = (container: HTMLElement) => {
            const aside = container.querySelector('aside');
            expect(aside).not.toBeNull();
            return aside as HTMLElement;
        };

        const paragraphsInside = (aside: HTMLElement) =>
            aside.querySelectorAll('[data-testid="analysis-paragraph"]').length;

        describe.each([
            ['길 때', LONG_PARAGRAPH_COUNT],
            ['짧을 때', SHORT_PARAGRAPH_COUNT],
        ])('AI 분석 패널이 %s', (_label, paragraphCount) => {
            it('분석은 aside 안에 담기고, aside는 차트 높이에 맞춰 내부 스크롤한다', async () => {
                const aside = asideOf(
                    await renderWithParagraphs(paragraphCount)
                );

                expect(paragraphsInside(aside)).toBe(paragraphCount);
                expect(aside.className).toContain(CHART_HEIGHT);
                expect(aside.className).toContain('md:overflow-y-auto');
            });

            it('차트 컬럼이 분석 길이와 무관하게 확정 높이를 유지한다', async () => {
                const container = await renderWithParagraphs(paragraphCount);

                const chartColumn = container.querySelector(
                    `[class*="${CHART_HEIGHT}"]:not(aside)`
                );
                expect(chartColumn).not.toBeNull();
            });

            it('스크롤러는 aside 하나뿐이다', async () => {
                const container = await renderWithParagraphs(paragraphCount);

                const scrollers = [
                    ...container.querySelectorAll('[class*="overflow-y-auto"]'),
                ];
                expect(scrollers).toEqual([asideOf(container)]);
            });
        });

        // 차트·패널 높이는 각자 변수로 확정하므로 `items-start`가 빠져도 둘은 그대로다.
        // 하지만 드래그 핸들의 `self-stretch`는 이 전제에 기대므로 행 계약을 지킨다.
        it('행이 md:items-start를 유지해 드래그 핸들 self-stretch 전제가 깨지지 않는다', async () => {
            const container = await renderWithParagraphs(LONG_PARAGRAPH_COUNT);

            const row = container.firstElementChild as HTMLElement;
            expect(row.className).toContain('md:items-start');
        });
    });
});
