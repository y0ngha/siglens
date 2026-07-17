import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

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
vi.mock('../hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: () => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    }),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => ({
        modelId: 'gemini-2.5-flash',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudge: vi.fn(),
    }),
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
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: () => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    }),
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
vi.mock('@/features/symbol-chat', () => ({ usePublishSymbolChat: vi.fn() }));
vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
}));
// portfolio-position 위젯은 useCurrentUser/useSymbolHolding(react-query)에
// 의존하므로 QueryClientProvider 없는 이 테스트 트리에서 실제 훅을 호출하면
// 크래시한다. 슬롯 분기와 무관하므로 no-op stub으로 대체한다.
vi.mock('@/widgets/portfolio-position', () => ({
    PositionSectionMounted: () => null,
}));

function analysisReturn(analysis: AnalysisResponse): UseAnalysisResult {
    return {
        analysis,
        analysisResult: analysis === FALLBACK_ANALYSIS ? null : analysis,
        lockedInfoDepth: [],
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

    // C1.a 회귀 가드: 봇으로 판정돼(isBotBlocked) 서사가 없을 때, 봇 안내문이
    // 사실 층을 '교체'하면 JS 렌더링 크롤러의 DOM에 종목 고유 텍스트가 사라진다.
    // 사실 층은 유지하고 안내문은 additive로만 덧붙어야 한다.
    it('봇 차단이고 서사가 없으면 사실 층을 유지하고 안내문으로 덮어쓰지 않는다', () => {
        baseAnalysis.mockReturnValue({
            ...analysisReturn(FALLBACK_ANALYSIS),
            isBotBlocked: true,
        });
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );
        // 종목 고유 실측(사실 층)이 정확히 1개 존재 — 이전엔 BotBlockedNotice가 통째로 교체했다.
        // toBe(1)로 '교체 안 됨'과 '중복 렌더' 양쪽을 모두 falsify한다.
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBe(1);
        // 봇 안내도 정확히 1개 additive로 함께 노출돼 오판된 실사용자에게 hint를 유지한다.
        expect(screen.getAllByText(/봇 트래픽으로 보여/).length).toBe(1);
    });

    // PR #530 Gemini 리뷰: 서사가 있어도(캐시 분석 표시 중) 봇 판정이면 AnalysisPanel을
    // 유지하고 봇 안내를 additive로 함께 노출해야 한다 — 재분석이 봇으로 오판돼 차단된
    // 사실을 stale 분석만 보던 실사용자가 인지하도록. (no-narrative 분기와 동일 규칙)
    it('봇 차단이지만 서사가 있으면 AnalysisPanel과 봇 안내를 함께 노출한다', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승' };
        baseAnalysis.mockReturnValue({
            ...analysisReturn(real),
            isBotBlocked: true,
        });
        render(
            <ChartContent
                {...props}
                initialAnalysis={real}
                initialAnalysisFailed={false}
            />
        );
        // 캐시된 분석(AnalysisPanel)이 그대로 유지된다(안내문으로 교체되지 않음).
        expect(screen.getAllByTestId('analysis-panel').length).toBe(1);
        // 사실 층도 함께 유지된다 — 서사 분기에서도 실측 텍스트는 항상 노출된다.
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBe(1);
        // 봇 안내는 그 아래 additive로 정확히 1개 노출된다.
        expect(screen.getAllByText(/봇 트래픽으로 보여/).length).toBe(1);
    });
});
