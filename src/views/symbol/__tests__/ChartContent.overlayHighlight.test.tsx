import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

/**
 * R5(§4.3) 회귀 커버리지 — `ChartContent`가 소유하는
 * `highlightedOverlayRef`/`prevAnalyzedAt` 렌더-단계 리셋 로직 전용 파일이다.
 *
 * `ChartContent.interaction.test.tsx`의 공유 `StockChart`/`AnalysisPanel` mock은
 * `highlightedOverlayRef`를 그대로 흘려보내지 않는 얇은 stub이라(prop을
 * 캡처하지 않음) 그 파일의 mock을 이 목적으로 "느슨하게" 바꾸면 수십 개의
 * 기존 단언이 그 변경에 얹혀 회귀 위험을 키운다. 대신 이 파일은 독립
 * (파일-scope) mock으로 필요한 prop만 노출한다 — 다른 테스트 파일에 영향 없음.
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
vi.mock('@/widgets/chart/hooks/useChartSync', () => ({
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));
vi.mock('@/widgets/chart/StockChart', () => ({
    StockChart: ({
        highlightedOverlayRef,
    }: {
        highlightedOverlayRef?: string | null;
    }) => (
        <div
            data-testid="stock-chart"
            data-highlighted={String(highlightedOverlayRef)}
        />
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
vi.mock('../hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: () => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    }),
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
        highlightedOverlayRef,
        onToggleOverlayHighlight,
    }: {
        highlightedOverlayRef?: string | null;
        onToggleOverlayHighlight?: (ref: string) => void;
    }) => (
        <div
            data-testid="analysis-panel"
            data-highlighted={String(highlightedOverlayRef)}
        >
            <button
                type="button"
                onClick={() => onToggleOverlayHighlight?.('p1')}
            >
                toggle p1
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
        plain: null,
        ...overrides,
    };
}

const NARRATIVE_ANALYSIS = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };

const props = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
    timeframeChangeCount: 0,
    onMobileSheetContent: vi.fn(),
    fmpSymbol: 'AAPL',
};

describe('ChartContent — 차트 작도 강조 상태(highlightedOverlayRef)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('원본 카드 토글로 강조를 켜면 AnalysisPanel과 StockChart 둘 다 같은 ref를 받는다', async () => {
        analysisMock.mockReturnValue(
            analysisReturn({ analysis: NARRATIVE_ANALYSIS })
        );
        render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'toggle p1' }));

        expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
            'data-highlighted',
            'p1'
        );
        // StockChart는 `next/dynamic({ssr:false})`로 lazy-load되므로 첫 렌더에는
        // 아직 마운트되지 않는다 — dynamic import가 resolve된 뒤에야 나타난다.
        expect(await screen.findByTestId('stock-chart')).toHaveAttribute(
            'data-highlighted',
            'p1'
        );
    });

    it('analyzedAt이 바뀌는(새 분석 도착) 렌더에서 강조를 렌더 단계에서 리셋한다', async () => {
        analysisMock.mockReturnValue(
            analysisReturn({
                analysis: {
                    ...NARRATIVE_ANALYSIS,
                    analyzedAt: '2026-01-01T00:00:00Z',
                },
            })
        );
        const { rerender } = render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'toggle p1' }));
        expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
            'data-highlighted',
            'p1'
        );
        await screen.findByTestId('stock-chart');

        // 새 분석 도착 — analyzedAt이 바뀐다. useAnalysis 훅이 새 결과를
        // 돌려주는 것을 흉내내 재렌더한다.
        analysisMock.mockReturnValue(
            analysisReturn({
                analysis: {
                    ...NARRATIVE_ANALYSIS,
                    analyzedAt: '2026-01-02T00:00:00Z',
                },
            })
        );
        rerender(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
            'data-highlighted',
            'null'
        );
        expect(screen.getByTestId('stock-chart')).toHaveAttribute(
            'data-highlighted',
            'null'
        );
    });

    it('analyzedAt이 그대로면(같은 분석의 재렌더) 강조를 유지한다', () => {
        const sameAnalysis = {
            ...NARRATIVE_ANALYSIS,
            analyzedAt: '2026-01-01T00:00:00Z',
        };
        analysisMock.mockReturnValue(
            analysisReturn({ analysis: sameAnalysis })
        );
        const { rerender } = render(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'toggle p1' }));
        expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
            'data-highlighted',
            'p1'
        );

        // 같은 analyzedAt으로 다시 렌더(예: 무관한 상위 상태 변화) — 강조가
        // 살아 있어야 한다. 새 객체 참조라도 analyzedAt이 같으면 리셋하지
        // 않는다(참조 비교가 아니라 analyzedAt 비교라는 게 이 로직의 요점).
        analysisMock.mockReturnValue(
            analysisReturn({ analysis: { ...sameAnalysis } })
        );
        rerender(
            <ChartContent
                {...props}
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
            />
        );

        expect(screen.getByTestId('analysis-panel')).toHaveAttribute(
            'data-highlighted',
            'p1'
        );
    });
});
