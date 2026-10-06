import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

/**
 * 레벨선 제목이 마지막 캔들을 덮지 않게 비우는 오른쪽 여백의 배선 — `StockChart`가
 * `onRightGutterChange`로 알린 값이 `useChartSync().setRightOffsetPixels`로 그대로
 * 흘러가는지만 본다. 값 계산은 `StockChart.test.tsx`, 두 차트에 적용하는 부분은
 * `useChartSync.test.ts`가 맡는다. 다른 ChartContent 테스트의 공유 mock을 건드리지
 * 않도록 파일-scope mock을 쓴다.
 */
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => null,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({ ChartSkeleton: () => null }));
vi.mock('@/widgets/chart/TimeframeSelector', () => ({
    TimeframeSelector: () => null,
}));
const setRightOffsetPixelsMock = vi.fn();
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
        setRightOffsetPixels: setRightOffsetPixelsMock,
    }),
}));
vi.mock('@/widgets/chart/StockChart', () => ({
    StockChart: ({
        onRightGutterChange,
    }: {
        onRightGutterChange?: (pixels: number) => void;
    }) => (
        <button
            type="button"
            data-testid="stock-chart"
            onClick={() => onRightGutterChange?.(88)}
        >
            report gutter
        </button>
    ),
}));
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
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({
        modelId: 'gemini-3.6-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        tier: 'free',
        isTierHydrated: true,
        openSignupNudge: vi.fn(),
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
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: () => ({
        clusteredKeyLevels: { support: [], resistance: [] },
        validatedActionPrices: [],
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
    AnalysisPanel: ({
        onHighlightOverlay,
    }: {
        onHighlightOverlay?: (key: string | null) => void;
    }) => (
        <div data-testid="analysis-panel">
            <button type="button" onClick={() => onHighlightOverlay?.('p1')}>
                highlight p1
            </button>
        </div>
    ),
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

const props = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
    timeframeChangeCount: 0,
    onMobileSheetContent: vi.fn(),
    fmpSymbol: 'AAPL',
};

describe('ChartContent — 차트 오른쪽 여백 배선', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        analysisMock.mockReturnValue(analysisReturn());
    });

    it('StockChart가 알린 여백(px)을 useChartSync의 setRightOffsetPixels로 넘긴다', async () => {
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        // StockChart는 `next/dynamic({ssr:false})`라 import가 resolve된 뒤에 나타난다.
        fireEvent.click(await screen.findByTestId('stock-chart'));

        expect(setRightOffsetPixelsMock).toHaveBeenCalledWith(88);
    });
});
