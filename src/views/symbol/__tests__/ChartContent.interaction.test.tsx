import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { ChartContent } from '../ChartContent';
import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH } from '../hooks/usePanelResize';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

// 무거운 차트/하위 훅은 stub. 단, usePanelResize/useDragListener는 실제 구현을
// 사용해 키보드·마우스 드래그가 실제로 panelWidth(aria-valuenow)를 바꾸는지
// 검증한다. 배너 분기 검증을 위해 useAnalysis·useAnalysisDisplay만 테스트별로
// 제어한다. (slot 테스트와 동일하게 vi.mock은 hoist되지만 import/first를 위해
// 위에 모은다.)
vi.mock('@/widgets/chart', () => ({
    ChartErrorFallback: () => null,
    ChartSkeleton: () => null,
    TimeframeSelector: () => null,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));
// ChartContent는 StockChart/VolumeChart를 dynamic()으로 deep import한다. async
// 테스트(userEvent) 진행 중 dynamic import가 해소되며 실제 차트가 mount되면
// lightweight-charts/useVolumeChartData가 mock 데이터에서 크래시하므로 stub한다.
vi.mock('@/widgets/chart/StockChart', () => ({ StockChart: () => null }));
vi.mock('@/widgets/chart/VolumeChart', () => ({ VolumeChart: () => null }));
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: () => ({
        bars: [
            { time: 0, open: 100, high: 120, low: 90, close: 100, volume: 1 },
            { time: 1, open: 100, high: 115, low: 100, close: 110, volume: 1 },
        ],
        indicators: { rsi: [null, 55], macd: [] },
    }),
}));
const analysisMock = vi.fn();
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => analysisMock(),
}));
// usePanelResize/useDragListener는 mock하지 않는다 — 실제 상호작용을 검증한다.
vi.mock('../hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: () => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    }),
}));
const symbolModelMock = vi.fn();
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => symbolModelMock(),
}));
vi.mock('@/features/analysis-nudge', () => ({
    useAnonAnalysisNudge: () => ({
        isLoginResolved: false,
        onSymbolAnalyzed: vi.fn(),
    }),
}));
vi.mock('../SymbolPageContext', () => ({
    useSymbolPageContext: () => ({ indicatorCount: 25 }),
}));
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: () => ({
        clusteredKeyLevels: { support: [], resistance: [] },
        validatedActionPrices: [],
        reconciledActionLines: [],
    }),
}));
const displayMock = vi.fn();
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: () => displayMock(),
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
vi.mock('@/features/symbol-chat', () => ({ usePublishSymbolChat: vi.fn() }));
vi.mock('@/widgets/analysis', () => ({
    // isFreeUser는 광고 게이팅 prop이다. Pro tier에서 false가 실제로 전달되는지
    // 검증할 수 있도록 data 속성으로 노출한다(회귀 방지 — fix-log PR #690).
    AnalysisPanel: ({ isFreeUser }: { isFreeUser?: boolean }) => (
        <div data-testid="analysis-panel" data-free-user={String(isFreeUser)} />
    ),
    // 서사 없는 첫 분석의 로딩 인디케이터. ChartContent는 이 컴포넌트를
    // displayAnalyzing 분기에서 렌더하므로 배너와 구분되는 stub으로 대체한다.
    AnalysisProgress: ({
        phaseIndex,
        tipIndex,
        isFreeUser,
    }: {
        phaseIndex: number;
        tipIndex: number;
        isFreeUser?: boolean;
    }) => (
        <div
            data-testid="analysis-progress"
            role="status"
            aria-label="AI 분석 진행 중"
            data-phase={phaseIndex}
            data-tip={tipIndex}
            data-free-user={String(isFreeUser)}
        />
    ),
}));

function analysisReturn(
    overrides: Partial<UseAnalysisResult> = {}
): UseAnalysisResult {
    return {
        analysis: FALLBACK_ANALYSIS,
        analysisResult: null,
        lockedInfoDepth: [],
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
        isPersonalized: false,
        ...overrides,
    };
}

// 서사가 있는(= fallback이 아닌) 분석. summary만 sentinel에서 벗어나면
// isFallbackAnalysis가 false를 반환해 ChartContent가 AnalysisPanel을 렌더한다.
const NARRATIVE_ANALYSIS = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };

function setTier(tier: 'free' | 'pro'): void {
    symbolModelMock.mockReturnValue({
        modelId: 'gemini-2.5-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        tier,
        isTierHydrated: true,
        openSignupNudge: vi.fn(),
    });
}

const props = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
    timeframeChangeCount: 0,
    onMobileSheetContent: vi.fn(),
    fmpSymbol: 'AAPL',
};

function renderChart() {
    return render(
        <ChartContent
            {...props}
            initialAnalysis={FALLBACK_ANALYSIS}
            initialAnalysisFailed={true}
        />
    );
}

function getSeparator(): HTMLElement {
    return screen.getByRole('separator', { name: '패널 너비 조절' });
}

describe('ChartContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 기본값: idle(분석 중 아님·에러 없음), 서사 없는 FALLBACK.
        displayMock.mockReturnValue({
            displayAnalyzing: false,
            handleProgressFinished: vi.fn(),
        });
        analysisMock.mockReturnValue(analysisReturn());
        // 기본값: free tier(하이드레이션 완료). isFreeUser = tier !== 'pro'가 true다.
        symbolModelMock.mockReturnValue({
            modelId: 'gemini-2.5-flash',
            isHydrated: true,
            reasoning: false,
            isReasoningHydrated: true,
            tier: 'free',
            isTierHydrated: true,
            openSignupNudge: vi.fn(),
        });
    });

    describe('상태 배너', () => {
        it('분석 중(서사 없음)이면 텍스트 배너가 아닌 AnalysisProgress 로딩 인디케이터를 렌더한다', () => {
            displayMock.mockReturnValue({
                displayAnalyzing: true,
                handleProgressFinished: vi.fn(),
            });
            renderChart();
            // 모바일 바텀시트에서도 진행 상태가 보이도록, 작은 텍스트 배너 대신
            // 스피너·페이즈를 갖춘 AnalysisProgress를 노출한다(이 PR의 핵심 동작).
            const progress = screen.getByTestId('analysis-progress');
            expect(progress).toBeInTheDocument();
            expect(progress).toHaveAttribute('role', 'status');
            expect(progress).toHaveAttribute('aria-label', 'AI 분석 진행 중');
            // 구식 인라인 텍스트 배너는 더 이상 렌더되지 않는다.
            expect(screen.queryByText('AI 분석 중…')).toBeNull();
        });

        it('분석 에러가 있으면 에러 메시지 배너를 렌더한다', () => {
            analysisMock.mockReturnValue(
                analysisReturn({
                    analysisError: '네트워크 오류로 분석에 실패했습니다.',
                })
            );
            renderChart();
            expect(
                screen.getByText('네트워크 오류로 분석에 실패했습니다.')
            ).toBeInTheDocument();
        });

        it('idle(분석 중 아님·에러 없음)이면 상태 배너를 렌더하지 않는다', () => {
            renderChart();
            // 사실 층은 정확히 한 번 보이되 진행/에러 배너는 없어야 한다.
            // (mobileContent는 콜백으로만 전달되고 DOM에 렌더되지 않으므로 1회.)
            expect(screen.getAllByText(/기술적 지표 요약/)).toHaveLength(1);
            expect(screen.queryByText('AI 분석 중…')).toBeNull();
        });

        it('봇 차단(서사 없음) 시 사실 층을 유지한 채 BotBlockedNotice를 additive로 함께 렌더하고 진행 배너는 내지 않는다', () => {
            analysisMock.mockReturnValue(
                analysisReturn({ isBotBlocked: true })
            );
            renderChart();
            expect(
                screen.getByText(
                    /봇 트래픽으로 보여 분석 결과를 표시하지 않았어요/
                )
            ).toBeInTheDocument();
            // 봇 안내는 사실 층을 '교체'하지 않고 그 아래 additive로 덧붙는다(PR #530).
            // 종목 고유 실측 텍스트가 렌더 DOM에 남아야 JS 렌더링 크롤러의 색인 의도가
            // 유지된다 — 봇으로 오판된 실사용자에게도 actionable hint가 남는다.
            expect(screen.getByText(/기술적 지표 요약/)).toBeInTheDocument();
            // idle(분석 중 아님)이므로 진행 배너는 없다.
            expect(screen.queryByText('AI 분석 중…')).toBeNull();
        });
    });

    // isFreeUser는 광고 게이팅 prop이다. 기본값 true에 의존하면 Pro 사용자에게
    // 광고가 새는 회귀가 발생했었다(fix-log PR #690). ChartContent가 tier로
    // 계산한 값이 AnalysisProgress·AnalysisPanel 양쪽에 정확히 전달되는지 검증한다.
    describe('광고 게이팅(isFreeUser) 전달', () => {
        it('free tier면 AnalysisProgress에 isFreeUser=true를 전달한다', () => {
            setTier('free');
            displayMock.mockReturnValue({
                displayAnalyzing: true,
                handleProgressFinished: vi.fn(),
            });
            renderChart();
            expect(screen.getByTestId('analysis-progress')).toHaveAttribute(
                'data-free-user',
                'true'
            );
        });

        it('pro tier면 AnalysisProgress에 isFreeUser=false를 전달한다', () => {
            setTier('pro');
            displayMock.mockReturnValue({
                displayAnalyzing: true,
                handleProgressFinished: vi.fn(),
            });
            renderChart();
            expect(screen.getByTestId('analysis-progress')).toHaveAttribute(
                'data-free-user',
                'false'
            );
        });

        it('free tier면 AnalysisPanel에 isFreeUser=true를 전달한다', () => {
            setTier('free');
            analysisMock.mockReturnValue(
                analysisReturn({ analysis: NARRATIVE_ANALYSIS })
            );
            renderChart();
            expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
                'data-free-user',
                'true'
            );
        });

        it('pro tier면 AnalysisPanel에 isFreeUser=false를 전달한다', () => {
            setTier('pro');
            analysisMock.mockReturnValue(
                analysisReturn({ analysis: NARRATIVE_ANALYSIS })
            );
            renderChart();
            expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
                'data-free-user',
                'false'
            );
        });
    });

    describe('패널 리사이즈 상호작용', () => {
        it('초기 패널 너비는 PANEL_MAX_WIDTH다', () => {
            renderChart();
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MAX_WIDTH)
            );
        });

        it('키보드 ArrowLeft/ArrowRight로 패널 너비를 한 스텝씩 조절한다', async () => {
            const user = userEvent.setup();
            renderChart();
            getSeparator().focus();

            await user.keyboard('{ArrowLeft}');
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MAX_WIDTH - 10)
            );

            await user.keyboard('{ArrowRight}');
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MAX_WIDTH)
            );
        });

        it('화살표가 아닌 키는 패널 너비를 바꾸지 않는다', async () => {
            const user = userEvent.setup();
            renderChart();
            getSeparator().focus();

            await user.keyboard('{Enter}');
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MAX_WIDTH)
            );
        });

        it('ArrowLeft를 하한 이하로 눌러도 PANEL_MIN_WIDTH에서 멈춘다', async () => {
            const user = userEvent.setup();
            renderChart();
            getSeparator().focus();

            // (MAX-MIN)/10 보다 충분히 많이 눌러 하한 클램프를 확인한다.
            const presses =
                Math.ceil((PANEL_MAX_WIDTH - PANEL_MIN_WIDTH) / 10) + 5;
            await user.keyboard('{ArrowLeft}'.repeat(presses));

            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MIN_WIDTH)
            );
        });

        it('마우스 드래그로 패널 너비를 줄이고 드래그 중 오버레이를 표시한다', () => {
            const { container } = renderChart();

            // 드래그 시작 — clientX 기준점 500.
            fireEvent.mouseDown(getSeparator(), { button: 0, clientX: 500 });
            // isDragging → separator 활성 보더 + 전체 화면 오버레이.
            expect(getSeparator()).toHaveClass('border-primary-500');
            expect(container.querySelector('.fixed.inset-0')).not.toBeNull();

            // separator는 오른쪽 분석 패널(aside) 왼쪽 경계다. 오른쪽으로 끌면 패널이
            // 줄어든다 — usePanelResize는 nextWidth = startWidth - deltaX로 계산하고
            // deltaX = moveX - startX다. 500→560(+60) → 640 - 60 = 580.
            fireEvent.mouseMove(document, { clientX: 560 });
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MAX_WIDTH - 60)
            );

            // 드래그 종료 → 오버레이 제거.
            fireEvent.mouseUp(document);
            expect(getSeparator()).not.toHaveClass('border-primary-500');
            expect(container.querySelector('.fixed.inset-0')).toBeNull();
        });

        it('드래그로 하한 아래까지 끌어도 PANEL_MIN_WIDTH에서 클램프된다', () => {
            renderChart();

            fireEvent.mouseDown(getSeparator(), { button: 0, clientX: 0 });
            // 오른쪽으로 (MAX-MIN+200)px 이동 → 하한 이하 요구 → MIN으로 클램프.
            fireEvent.mouseMove(document, {
                clientX: PANEL_MAX_WIDTH - PANEL_MIN_WIDTH + 200,
            });
            expect(getSeparator()).toHaveAttribute(
                'aria-valuenow',
                String(PANEL_MIN_WIDTH)
            );
            fireEvent.mouseUp(document);
        });

        it('우클릭(button≠0)은 드래그를 시작하지 않는다', () => {
            const { container } = renderChart();

            fireEvent.mouseDown(getSeparator(), { button: 2, clientX: 500 });
            expect(container.querySelector('.fixed.inset-0')).toBeNull();
            expect(getSeparator()).not.toHaveClass('border-primary-500');
        });
    });
});
