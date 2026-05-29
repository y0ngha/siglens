import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { ChartContent } from '../ChartContent';

// 무거운 차트/하위 훅은 stub. 슬롯 분기에 필요한 useBars/useAnalysis만 제어.
// vitest가 vi.mock 호출을 파일 최상단으로 호이스팅하므로, 선언 위치와 무관하게
// 모킹이 적용된다. eslint import/first를 만족시키려고 import를 모두 위에 모으고
// mock 선언을 그 아래에 둔다 (둘 다 동작하는 동등 표현).
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
vi.mock('../hooks/useBars', () => ({
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
vi.mock('../hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: () => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    }),
}));
vi.mock('../SymbolModelContext', () => ({
    useSymbolModel: () => ({ modelId: 'gemini-2.5-flash', isHydrated: true }),
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
vi.mock('../hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
vi.mock('@/features/symbol-chat', () => ({ usePublishSymbolChat: vi.fn() }));
vi.mock('../FearGreedCardMounted', () => ({
    FearGreedCardMounted: () => null,
}));
vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
}));

function analysisReturn(analysis: AnalysisResponse) {
    return {
        analysis,
        analysisResult: analysis === FALLBACK_ANALYSIS ? null : analysis,
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
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

beforeEach(() => vi.clearAllMocks());

describe('ChartContent 슬롯 규칙', () => {
    it('FALLBACK(서사 없음)이면 사실 층을 렌더한다', () => {
        baseAnalysis.mockReturnValue(analysisReturn(FALLBACK_ANALYSIS));
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBeGreaterThan(
            0
        );
        expect(screen.queryByTestId('analysis-panel')).toBeNull();
    });

    it('실제 분석(서사 있음)이면 AnalysisPanel을 렌더한다', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승' };
        baseAnalysis.mockReturnValue(analysisReturn(real));
        render(
            <ChartContent
                {...props}
                initialAnalysis={real}
                initialAnalysisFailed={false}
            />
        );
        expect(screen.getAllByTestId('analysis-panel').length).toBeGreaterThan(
            0
        );
    });
});
