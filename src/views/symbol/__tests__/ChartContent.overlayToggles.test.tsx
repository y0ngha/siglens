import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AnalysisResponse, ChartOverlay } from '@y0ngha/siglens-core';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ACTION_PRICES_ITEM_KEY } from '@/widgets/chart/utils/overlayItems';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

/**
 * 설계 2026-09-29 회귀 커버리지 — `ChartContent`가 `StockChart`(차트 헤더 메뉴)와
 * `AnalysisPanel`(카드 버튼)에 **같은 `useOverlayItemVisibility` 상태**를 배선하는지
 * 검증한다. 메뉴에서 끄면 카드에도 반영되고(메뉴→패널), 카드에서 다시 켜면 메뉴도
 * 따라온다(패널→메뉴) — 매매 가격선도 같은 상태선을 탄다.
 *
 * `ChartContent.interaction.test.tsx`의 공유 mock은 이 목적에 필요한 prop들을
 * 캡처하지 않는 얇은 stub이라(overlayHighlight 테스트 파일 주석과 동일한 이유)
 * 이 파일은 독립 mock으로 `StockChart`/`AnalysisPanel`에 전달된 실제 props를
 * 직접 캡처한다.
 */
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

interface CapturedStockChartProps {
    overlayItems?: readonly { key: string; kind: string }[];
    hiddenOverlayKeys?: ReadonlySet<string>;
    highlightedOverlayKey?: string | null;
    onSetOverlayVisible?: (keys: readonly string[], visible: boolean) => void;
    actionPricesVisible?: boolean;
}

interface CapturedAnalysisPanelProps {
    overlaySourceRefs?: ReadonlySet<string>;
    hiddenOverlayKeys?: ReadonlySet<string>;
    onToggleOverlay?: (key: string) => void;
    onHighlightOverlay?: (key: string | null) => void;
    onClearOverlayHighlight?: (key: string) => void;
    actionPricesVisible?: boolean;
    onActionPricesVisibilityChange?: (visible: boolean) => void;
}

// vi.mock factories are hoisted above imports, so capture targets must be
// declared through vi.hoisted (same pattern as ChartContent.test.tsx).
const { stockChartProps, analysisPanelProps } = vi.hoisted(() => ({
    stockChartProps: { current: {} as CapturedStockChartProps },
    analysisPanelProps: { current: {} as CapturedAnalysisPanelProps },
}));

vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => null,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({ ChartSkeleton: () => null }));
vi.mock('@/widgets/chart/TimeframeSelector', () => ({
    TimeframeSelector: () => null,
}));
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));
vi.mock('@/widgets/chart/StockChart', () => ({
    StockChart: (props: CapturedStockChartProps) => {
        stockChartProps.current = props;
        return <div data-testid="stock-chart" />;
    },
}));
vi.mock('@/widgets/chart/VolumeChart', () => ({ VolumeChart: () => null }));
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: () => ({
        bars: [
            { time: 0, open: 100, high: 120, low: 90, close: 100, volume: 1 },
            { time: 1, open: 100, high: 115, low: 100, close: 110, volume: 1 },
            { time: 2, open: 110, high: 118, low: 105, close: 112, volume: 1 },
        ],
        indicators: { rsi: [null, 55, 60], macd: [] },
    }),
}));
const analysisMock = vi.fn();
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => analysisMock(),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({
        modelId: 'gemini-3.6-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        tier: 'free',
        isTierHydrated: true,
        openSignupNudgeAs: vi.fn(),
    }),
}));
vi.mock('@/features/analysis-nudge/hooks/useAnonAnalysisNudge', () => ({
    useAnonAnalysisNudge: () => ({
        isLoginResolved: false,
        onSymbolAnalyzed: vi.fn(),
    }),
}));
vi.mock('../SymbolPageContext', () => ({
    useSymbolPageContext: () => ({ indicatorCount: 25 }),
}));
// hasActionPrices는 validatedActionPrices !== undefined로만 결정된다 — 이
// 훅을 직접 목해 실제 actionRecommendation 정규화 경로를 거치지 않고 "매매
// 가격선이 있다"는 조건만 통제한다.
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: () => ({
        clusteredKeyLevels: { support: [], resistance: [] },
        validatedActionPrices: {
            entryPrices: [100],
            stopLoss: 90,
            takeProfitPrices: [120],
        },
        reconciledActionLines: [],
    }),
}));
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: () => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    }),
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: CapturedAnalysisPanelProps) => {
        analysisPanelProps.current = props;
        return <div data-testid="analysis-panel" />;
    },
}));
vi.mock('@/widgets/analysis/AnalysisProgress', () => ({
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding', () => ({
    useSymbolHolding: () => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    }),
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
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
        isPersonalized: false,
        isAwaitingInteraction: false,
        isInstantResponse: false,
        syncReanalyzeCooldown: vi.fn(),
        plain: null,
        ...overrides,
    };
}

const PATTERN_OVERLAY: ChartOverlay = {
    id: 'pattern:double_bottom:1',
    kind: 'pattern',
    skill: 'double_bottom',
    sourceRef: 'pattern-1',
    variant: 'primary',
    segments: [
        {
            from: { time: 0, price: 100 },
            to: { time: 1, price: 110 },
            role: 'pattern',
            style: 'solid',
            pane: 'price',
        },
    ],
    levels: [],
    labels: [],
};

const NARRATIVE_ANALYSIS: AnalysisResponse = {
    ...FALLBACK_ANALYSIS,
    summary: 'AAPL 상승 추세',
    analyzedAt: '2026-01-01T00:00:00Z',
    patternSummaries: [
        {
            id: 'pattern-1',
            patternName: 'double_bottom',
            skillName: 'doubleBottom',
            detected: true,
            trend: 'bullish',
            summary: '더블 바텀 확인',
            confidenceWeight: 0.8,
        },
    ],
    chartOverlays: [PATTERN_OVERLAY],
};

const props = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
    timeframeChangeCount: 0,
    onMobileSheetContent: vi.fn(),
    fmpSymbol: 'AAPL',
};

describe('ChartContent — StockChart·AnalysisPanel 차트 작도 상태 배선', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        analysisMock.mockReturnValue(
            analysisReturn({ analysis: NARRATIVE_ANALYSIS })
        );
    });

    it('봉에 맞는 패턴 오버레이가 StockChart.overlayItems과 AnalysisPanel.overlaySourceRefs에 함께 들어간다', async () => {
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        await screen.findByTestId('stock-chart');

        expect(stockChartProps.current.overlayItems).toContainEqual(
            expect.objectContaining({ key: 'pattern-1', kind: 'pattern' })
        );
        expect(
            analysisPanelProps.current.overlaySourceRefs?.has('pattern-1')
        ).toBe(true);
    });

    it('메뉴(StockChart.onSetOverlayVisible)로 끄면 패널의 hiddenOverlayKeys에 반영된다', async () => {
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        await screen.findByTestId('stock-chart');

        act(() => {
            stockChartProps.current.onSetOverlayVisible?.(['pattern-1'], false);
        });

        expect(
            analysisPanelProps.current.hiddenOverlayKeys?.has('pattern-1')
        ).toBe(true);
    });

    it('패널(AnalysisPanel.onToggleOverlay)로 다시 켜면 메뉴의 hiddenOverlayKeys에서 빠진다', async () => {
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        await screen.findByTestId('stock-chart');

        act(() => {
            stockChartProps.current.onSetOverlayVisible?.(['pattern-1'], false);
        });
        expect(
            stockChartProps.current.hiddenOverlayKeys?.has('pattern-1')
        ).toBe(true);

        act(() => {
            analysisPanelProps.current.onToggleOverlay?.('pattern-1');
        });

        expect(
            stockChartProps.current.hiddenOverlayKeys?.has('pattern-1')
        ).toBe(false);
    });

    it('매매 가격선: 메뉴에서 끄면 StockChart·AnalysisPanel 둘 다 꺼지고, 패널에서 다시 켜면 둘 다 켜진다', async () => {
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        await screen.findByTestId('stock-chart');
        expect(stockChartProps.current.actionPricesVisible).toBe(true);
        expect(analysisPanelProps.current.actionPricesVisible).toBe(true);

        act(() => {
            stockChartProps.current.onSetOverlayVisible?.(
                [ACTION_PRICES_ITEM_KEY],
                false
            );
        });

        expect(stockChartProps.current.actionPricesVisible).toBe(false);
        expect(analysisPanelProps.current.actionPricesVisible).toBe(false);

        act(() => {
            analysisPanelProps.current.onActionPricesVisibilityChange?.(true);
        });

        expect(stockChartProps.current.actionPricesVisible).toBe(true);
        expect(analysisPanelProps.current.actionPricesVisible).toBe(true);
    });
});
