import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

// 폴백은 이제 로케일별 빌더다 — 예전 `FALLBACK_ANALYSIS` 상수는 한국어 요약을
// 들고 있어 `/en/AAPL`이 영어 화면에 한국어 폴백을 렌더했다.
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

// 무거운 차트/하위 훅은 stub. 슬롯 분기에 필요한 useBars/useAnalysis만 제어.
// vitest가 vi.mock 호출을 파일 최상단으로 호이스팅하므로, 선언 위치와 무관하게
// 모킹이 적용된다. eslint import/first를 만족시키려고 import를 모두 위에 모으고
// mock 선언을 그 아래에 둔다 (둘 다 동작하는 동등 표현).
vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => null,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => null,
}));
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
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: () => ({
        bars: [
            { time: 0, open: 100, high: 120, low: 90, close: 100, volume: 1 },
            { time: 1, open: 100, high: 115, low: 100, close: 110, volume: 1 },
        ],
        indicators: { rsi: [null, 55], macd: [] },
    }),
}));
const baseAnalysis = vi.fn();
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => baseAnalysis(),
}));
// 그 외 ChartContent가 의존하는 훅들 — 슬롯 분기에 무관한 최소 stub
vi.mock('../hooks/usePanelResize', () => ({
    usePanelResize: () => ({
        panelWidth: 360,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    }),
    PANEL_MIN_WIDTH: 280,
    PANEL_MAX_WIDTH: 600,
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({
        modelId: 'gemini-3.6-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
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
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
}));
// "내 포지션" 요약(PositionStatusSummary)의 소스 — react-query 기반이라
// QueryClientProvider 없는 이 트리에서 그대로 렌더하면 크래시한다. 이 파일의
// 관심사(슬롯 분기)와 무관하므로 "홀딩 없음"으로 고정한다.
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding', () => ({
    useSymbolHolding: () => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    }),
}));

function analysisReturn(analysis: AnalysisResponse): UseAnalysisResult {
    return {
        analysis,
        analysisResult: analysis === FALLBACK_ANALYSIS ? null : analysis,
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

describe('ChartContent 슬롯 규칙', () => {
    beforeEach(() => vi.clearAllMocks());

    it('FALLBACK(서사 없음)이면 사실 층을 렌더한다', () => {
        baseAnalysis.mockReturnValue(analysisReturn(FALLBACK_ANALYSIS));
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBe(1);
        expect(screen.queryByTestId('analysis-panel')).toBeNull();
    });

    it('실제 분석(서사 있음)이면 AnalysisPanel과 사실 층을 함께 렌더한다', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승' };
        baseAnalysis.mockReturnValue(analysisReturn(real));
        render(
            <ChartContent
                {...props}
                initialAnalysis={real}
                initialAnalysisFailed={false}
            />
        );
        expect(screen.getAllByTestId('analysis-panel').length).toBe(1);
        // 서사가 있어도 사실 층을 함께 노출한다 — 차트가 그리는 실측값을 크롤 가능한
        // 텍스트로 항상 유지하고, AnalysisPanel은 그 위에 서사를 additive로 얹는다.
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBe(1);
    });
});
