vi.mock('@/views/symbol/TechnicalFactsSummary', () => ({
    TechnicalFactsSummary: () => {
        mockFactsSummaryRender();
        return <div data-testid="facts-summary" />;
    },
}));

// 실제 `useBars`는 React Query 결과라 렌더 사이에 같은 참조를 돌려준다. 렌더마다 새 배열을
// 돌려주는 목은 지표 요약의 메모를 매번 깨 이 파일이 재려는 것을 가린다.
const { STABLE_BARS, mockFactsSummaryRender } = vi.hoisted(() => ({
    STABLE_BARS: {
        bars: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 500 },
        ],
        indicators: { buySellVolume: [] },
    },
    mockFactsSummaryRender: vi.fn(),
}));

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
const { mockAnalysisPanelProps } = vi.hoisted(() => ({
    mockAnalysisPanelProps: vi.fn(),
}));

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: {
        analysis?: { paragraphCount?: number };
        onReanalyzeIntent?: () => void;
    }) => {
        mockAnalysisPanelProps(props);
        return (
            <div data-testid="analysis-panel">
                {Array.from(
                    { length: props.analysis?.paragraphCount ?? 0 },
                    (_, i) => (
                        <p data-testid="analysis-paragraph" key={i}>
                            분석 문단 {i}
                        </p>
                    )
                )}
            </div>
        );
    },
}));

vi.mock('@/entities/extended-bars/hooks/useExtendedBars', () => ({
    useExtendedBars: () => null,
}));

vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: vi.fn(() => STABLE_BARS),
}));

vi.mock('@/views/symbol/hooks/useAnalysis', () => ({
    useAnalysis: vi.fn(() => ({
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        isAnalyzing: false,
        analysisError: null,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownUntil: 0,
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
        openSignupNudgeAs: mockOpenSignupNudge,
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

import { render, screen } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { ChartContent } from '@/views/symbol/ChartContent';
import { useBars } from '@/entities/bars/hooks/useBars';
import { useAnalysisProgress } from '@/widgets/analysis/hooks/useAnalysisProgress';

describe('ChartContent 지표 요약', () => {
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

    it('분석 진행 값만 바뀌면 지표 요약을 다시 그리지 않는다', () => {
        const { rerender } = render(<ChartContent {...defaultProps} />);
        expect(screen.getByTestId('facts-summary')).toBeInTheDocument();
        const rendersBefore = mockFactsSummaryRender.mock.calls.length;

        vi.mocked(useAnalysisProgress).mockReturnValue({
            phaseIndex: 1,
            tipIndex: 2,
        });
        rerender(<ChartContent {...defaultProps} />);

        expect(mockFactsSummaryRender).toHaveBeenCalledTimes(rendersBefore);
    });

    it('봉이 바뀌면 지표 요약을 다시 그린다', () => {
        const { rerender } = render(<ChartContent {...defaultProps} />);
        const rendersBefore = mockFactsSummaryRender.mock.calls.length;

        vi.mocked(useBars).mockReturnValue({
            ...STABLE_BARS,
            bars: [
                ...STABLE_BARS.bars,
                {
                    time: 2,
                    open: 105,
                    high: 112,
                    low: 101,
                    close: 110,
                    volume: 600,
                },
            ],
        } as never);
        rerender(<ChartContent {...defaultProps} />);

        expect(mockFactsSummaryRender.mock.calls.length).toBeGreaterThan(
            rendersBefore
        );
    });
});
