import { render, screen, within } from '@testing-library/react';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { ChartContent } from '../ChartContent';
import type { UseAnalysisResult } from '../hooks/useAnalysis';

// 폴백은 이제 로케일별 빌더다 — 예전 `FALLBACK_ANALYSIS` 상수는 한국어 요약을
// 들고 있어 `/en/AAPL`이 영어 화면에 한국어 폴백을 렌더했다.
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

// 결론 카드 배치 규칙 — 카드는 진짜로 렌더하고, 무거운 차트/하위 훅만 stub한다.
// vitest가 vi.mock 호출을 파일 최상단으로 호이스팅하므로, 선언 위치와 무관하게
// 모킹이 적용된다. import 블록을 하나로 이어 두려고 mock 선언을 모두 import 위에 둔다
// (TESTING.md#TE-1).
// StockChart만 스텁으로 바꾼다 — 슬롯이 `headerStartSlot`으로 넘어가는 배선만 본다.
vi.mock('next/dynamic', () => ({
    default: (loader: () => Promise<unknown>) => {
        if (!loader.toString().includes('StockChart')) return () => null;
        const Stub = (props: Record<string, unknown>) => {
            return (
                <div data-testid="stock-chart-stub">
                    {props.headerStartSlot as React.ReactNode}
                </div>
            );
        };
        return Stub;
    },
}));
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
vi.mock('@/entities/extended-bars/hooks/useExtendedBars', () => ({
    useExtendedBars: () => null,
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
const { derivedState } = vi.hoisted(() => ({
    derivedState: { hasLevels: true },
}));
vi.mock('../hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: () => ({
        clusteredKeyLevels: derivedState.hasLevels
            ? {
                  support: [{ price: 95, reason: 'r', count: 1, sources: [] }],
                  resistance: [
                      { price: 105, reason: 'r', count: 1, sources: [] },
                  ],
              }
            : { support: [], resistance: [] },
        validatedActionPrices: [],
        reconciledActionLines: [],
    }),
}));
const { displayState } = vi.hoisted(() => ({
    displayState: { displayAnalyzing: false },
}));
vi.mock('../hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: () => ({
        displayAnalyzing: displayState.displayAnalyzing,
        handleProgressFinished: vi.fn(),
    }),
}));
vi.mock('@/widgets/analysis/AnalysisProgress', () => ({
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }),
}));
const { panelProps } = vi.hoisted(() => ({
    panelProps: vi.fn(),
}));
vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => {
        panelProps(props);
        return <div data-testid="analysis-panel" />;
    },
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

function analysisReturn(
    analysis: AnalysisResponse,
    over: Partial<UseAnalysisResult> = {}
): UseAnalysisResult {
    return {
        analysis,
        analysisResult: analysis === FALLBACK_ANALYSIS ? null : analysis,
        lockedInfoDepth: [],
        isAnalyzing: false,
        analysisError: null,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownUntil: 0,
        cooldownNotice: null,
        isPersonalized: false,
        meter: null,
        isAwaitingInteraction: false,
        isInstantResponse: false,
        syncReanalyzeCooldown: vi.fn(),
        plain: null,
        ...over,
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

const REAL: AnalysisResponse = {
    ...FALLBACK_ANALYSIS,
    summary: 'AAPL 상승',
    trend: 'bullish',
};
const SLOT = <span data-testid="top-slot">slot</span>;
const CARD_NAME = '한눈에 보기';

function renderChart(
    analysis: AnalysisResponse,
    over: Partial<UseAnalysisResult> = {},
    onMobileSheetContent = vi.fn()
) {
    baseAnalysis.mockReturnValue(analysisReturn(analysis, over));
    render(
        <ChartContent
            {...props}
            onMobileSheetContent={onMobileSheetContent}
            initialAnalysis={analysis}
            initialAnalysisFailed={analysis === FALLBACK_ANALYSIS}
            panelTopSlot={SLOT}
        />
    );
    return onMobileSheetContent;
}

function precedes(first: Element, second: Element): boolean {
    return (
        (first.compareDocumentPosition(second) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    );
}

describe('ChartContent 결론 카드 배치', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        displayState.displayAnalyzing = false;
        derivedState.hasLevels = true;
    });

    describe('서사가 있는 분기', () => {
        it('카드, 슬롯, 패널, 지표 요약 순서로 렌더한다', () => {
            renderChart(REAL);

            const card = screen.getByRole('region', { name: CARD_NAME });
            const slot = screen.getByTestId('top-slot');
            const panel = screen.getByTestId('analysis-panel');
            const facts = screen.getByText(/기술적 지표 요약/);

            expect(precedes(card, slot)).toBe(true);
            expect(precedes(slot, panel)).toBe(true);
            expect(precedes(panel, facts)).toBe(true);
        });

        it('카드는 결과 상태이고 추세 헤드라인과 가까운 레벨을 보여 준다', () => {
            renderChart(REAL);

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveAttribute('data-analysis-conclusion', 'ready');
            expect(card).toHaveAttribute('aria-busy', 'false');
            expect(card).toHaveTextContent('현재 추세 강세');
            expect(card).toHaveTextContent('105.00');
            expect(card).toHaveTextContent('95.00');
        });

        it('카드가 형제라서 패널 카드 안에 들어가지 않는다', () => {
            renderChart(REAL);

            const card = screen.getByRole('region', { name: CARD_NAME });
            const panel = screen.getByTestId('analysis-panel');
            expect(card.contains(panel)).toBe(false);
            expect(panel.contains(card)).toBe(false);
            expect(card.parentElement).toBe(panel.parentElement);
        });

        it('패널에는 추세 배지를 숨기라고 알린다', () => {
            renderChart(REAL);

            expect(panelProps).toHaveBeenCalledWith(
                expect.objectContaining({ hideTrendBadge: true })
            );
        });

        // 실제 훅이 만드는 상태: 분석이 도는 동안 `onMutate`가 `analysisResult`를 비워
        // `analysis`는 무료 시드(레벨 없음, 손절 없음)로 되돌아간다.
        it('분석이 도는 동안(결과 없음, 시드 복귀)에는 로딩 카드이고 "없음"·"회원 전용"이 새지 않는다', () => {
            displayState.displayAnalyzing = true;
            derivedState.hasLevels = false;
            renderChart(REAL, {
                analysisResult: null,
                isAnalyzing: true,
                lockedInfoDepth: [],
            });

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveAttribute('data-analysis-conclusion', 'pending');
            expect(card).toHaveAttribute('aria-busy', 'true');
            expect(card).not.toHaveTextContent('없음');
            expect(card).not.toHaveTextContent('회원 전용');
            expect(card).not.toHaveTextContent('현재 추세');
        });

        it('회원의 첫 로드(무료 잠금 시드로 분석 중)에도 "회원 전용"이 아니라 로딩 카드다', () => {
            displayState.displayAnalyzing = true;
            derivedState.hasLevels = false;
            renderChart(REAL, {
                analysisResult: null,
                isAnalyzing: true,
                lockedInfoDepth: ['partial_detail', 'stoploss'],
            });

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveAttribute('data-analysis-conclusion', 'pending');
            expect(card).not.toHaveTextContent('회원 전용');
        });

        it('결과가 도착한 뒤 마무리 애니메이션이 도는 동안은 실제 값을 보인다', () => {
            displayState.displayAnalyzing = true;
            renderChart(REAL, { analysisResult: REAL, isAnalyzing: false });

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveAttribute('data-analysis-conclusion', 'ready');
            expect(card).toHaveAttribute('aria-busy', 'false');
            expect(card).toHaveTextContent('105.00');
        });

        it('잠긴 깊이를 카드에 그대로 넘겨 회원 전용으로 그린다', () => {
            renderChart(REAL, {
                lockedInfoDepth: ['partial_detail', 'stoploss'],
            });

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveTextContent('현재 추세 강세');
            expect(card.textContent?.match(/회원 전용/g)).toHaveLength(3);
        });

        it('모바일 시트로 올라가는 콘텐츠도 같은 순서로 카드를 담는다', () => {
            const onMobileSheetContent = renderChart(REAL);
            const sheetContent =
                onMobileSheetContent.mock.lastCall?.[0] ?? null;
            expect(sheetContent).not.toBeNull();
            render(<div data-testid="sheet">{sheetContent}</div>);

            const sheet = within(screen.getByTestId('sheet'));
            const card = sheet.getByRole('region', { name: CARD_NAME });
            expect(precedes(card, sheet.getByTestId('top-slot'))).toBe(true);
            expect(
                precedes(
                    sheet.getByTestId('top-slot'),
                    sheet.getByTestId('analysis-panel')
                )
            ).toBe(true);
            expect(
                precedes(
                    sheet.getByTestId('analysis-panel'),
                    sheet.getByText(/기술적 지표 요약/)
                )
            ).toBe(true);
        });
    });

    describe('서사가 없는 분기', () => {
        it('분석 중이면 로딩 카드가 슬롯과 진행 표시보다 앞에 온다', () => {
            displayState.displayAnalyzing = true;
            renderChart(FALLBACK_ANALYSIS, { isAnalyzing: true });

            const card = screen.getByRole('region', { name: CARD_NAME });
            expect(card).toHaveAttribute('data-analysis-conclusion', 'pending');
            expect(card).toHaveAttribute('aria-busy', 'true');
            expect(precedes(card, screen.getByTestId('top-slot'))).toBe(true);
            expect(
                precedes(card, screen.getByTestId('analysis-progress'))
            ).toBe(true);
            expect(
                precedes(
                    screen.getByTestId('analysis-progress'),
                    screen.getByText(/기술적 지표 요약/)
                )
            ).toBe(true);
        });

        it('입력을 기다리는 중이면 카드를 두지 않는다', () => {
            renderChart(FALLBACK_ANALYSIS, { isAwaitingInteraction: true });

            expect(
                screen.queryByRole('region', { name: CARD_NAME })
            ).toBeNull();
        });

        it('분석 오류면 카드를 두지 않는다', () => {
            renderChart(FALLBACK_ANALYSIS, {
                analysisError: '분석에 실패했어요',
            });

            expect(screen.getByText('분석에 실패했어요')).toBeInTheDocument();
            expect(
                screen.queryByRole('region', { name: CARD_NAME })
            ).toBeNull();
        });

        it('분석 중도 입력 대기도 아니면 카드를 두지 않는다', () => {
            renderChart(FALLBACK_ANALYSIS);

            expect(
                screen.queryByRole('region', { name: CARD_NAME })
            ).toBeNull();
        });

        it('로딩 카드는 모바일 시트 콘텐츠에도 들어 있다', () => {
            displayState.displayAnalyzing = true;
            const onMobileSheetContent = renderChart(FALLBACK_ANALYSIS, {
                isAnalyzing: true,
            });
            render(
                <div data-testid="sheet">
                    {onMobileSheetContent.mock.lastCall?.[0] ?? null}
                </div>
            );

            expect(
                within(screen.getByTestId('sheet')).getByRole('region', {
                    name: CARD_NAME,
                })
            ).toHaveAttribute('data-analysis-conclusion', 'pending');
        });
    });
});
