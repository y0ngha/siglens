// vi.mock → imports 순서 (MISTAKES.md Tests §17)

// ── congress ────────────────────────────────────────────────────────────
vi.mock('@/widgets/congress/hooks/useCongressTrend', () => ({
    useCongressTrend: vi.fn(),
}));

// ── financials ──────────────────────────────────────────────────────────
vi.mock('@/widgets/financials/hooks/useFinancialsAnalysis', () => ({
    useFinancialsAnalysis: vi.fn(),
}));

// ── fundamental ─────────────────────────────────────────────────────────
vi.mock('@/widgets/fundamental/hooks/useFundamentalAnalysis', () => ({
    useFundamentalAnalysis: vi.fn(),
}));

// ── news ────────────────────────────────────────────────────────────────
vi.mock('@/widgets/news/hooks/useNewsAnalysis', () => ({
    useNewsAnalysis: vi.fn(),
}));
vi.mock('@/widgets/news/hooks/useWaitForNewsCards', () => ({
    useWaitForNewsCards: vi.fn(() => ({ isReady: true, pollError: null })),
}));
vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/lib/news/periodLabels', () => ({
    NEWS_ANALYSIS_PERIOD_KEY: 'last30Days',
}));

// ── options ─────────────────────────────────────────────────────────────
vi.mock('@/widgets/options/hooks/useOptionsAnalysis', () => ({
    useOptionsAnalysis: vi.fn(),
}));
vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: (d: string) => d,
}));

// ── overall ─────────────────────────────────────────────────────────────
vi.mock('@/widgets/overall/hooks/useOverallAnalysis', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@/widgets/overall/hooks/useOverallAnalysis')
        >();
    return {
        ...actual,
        useOverallAnalysis: vi.fn(),
    };
});
vi.mock('@/widgets/news', async importOriginal => ({
    ...(await importOriginal<typeof import('@/widgets/news')>()),
    useNewsAnalysisTrigger: vi.fn(),
    useWaitForNewsCards: vi.fn((_symbol: string, initiallyReady: boolean) => ({
        isReady: initiallyReady,
        pollError: null,
    })),
}));
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));
vi.mock('@/entities/analysis/actions', () => ({
    runOverallAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ replace: vi.fn() }),
}));

// ── chart (ChartContent) ────────────────────────────────────────────────
vi.mock('next/dynamic', () => ({
    default: (_loader: () => Promise<{ default: React.FC }>) => {
        const Component = (_props: Record<string, unknown>) => (
            <div data-testid="dynamic-component" />
        );
        Component.displayName = 'DynamicMock';
        return Component;
    },
}));
vi.mock('@/widgets/chart', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));
vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
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
    useAnalysis: vi.fn(),
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
vi.mock('@/views/symbol/hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: vi.fn(() => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    })),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-2.5-flash-lite',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudge: vi.fn(),
    })),
}));
vi.mock('@/features/analysis-nudge', () => ({
    useAnonAnalysisNudge: vi.fn(() => ({
        isLoginResolved: true,
        onSymbolAnalyzed: vi.fn(),
    })),
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
    useAnalysisProgress: vi.fn(() => ({ phaseIndex: 0, tipIndex: 0 })),
}));
vi.mock('@/features/portfolio-holding', () => ({
    useSymbolHolding: vi.fn(() => ({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {} as never,
    })),
}));

// ── shared across all sections ─────────────────────────────────────────
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/features/symbol-model', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
    useAnalysisSettingsHydrated: vi.fn(() => true),
    useDefaultReasoning: vi.fn(() => false),
    useSymbolModel: vi.fn(() => ({ tier: 'member', isTierHydrated: true })),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/congress/utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('@/widgets/financials/utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('@/widgets/fundamental/utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('@/widgets/news/utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('@/widgets/options/utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('@/views/symbol/utils/buildChatState', () => ({
    buildChatState: vi.fn(() => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: false,
    })),
}));
vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));
vi.mock('@/widgets/congress/CongressTrendSummarySkeleton', () => ({
    CongressTrendSummarySkeleton: () => <div data-testid="congress-skeleton" />,
}));
vi.mock('@/widgets/congress/CongressTrendSummaryEmpty', () => ({
    CongressTrendSummaryEmpty: () => <div data-testid="congress-empty" />,
}));
vi.mock('@/widgets/congress/CongressTrendSummaryError', () => ({
    CongressTrendSummaryError: () => <div data-testid="congress-error" />,
}));
vi.mock('@/widgets/financials/FinancialsAiSummaryError', () => ({
    FinancialsAiSummaryError: () => <div data-testid="financials-error" />,
}));
vi.mock('@/widgets/financials/FinancialsAiSummarySkeleton', () => ({
    FinancialsAiSummarySkeleton: () => (
        <div data-testid="financials-skeleton" />
    ),
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => <div data-testid="fundamental-error" />,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => (
        <div data-testid="fundamental-skeleton" />
    ),
}));
vi.mock('@/widgets/options/OptionsAiAnalysisSkeleton', () => ({
    OptionsAiAnalysisSkeleton: () => <div data-testid="options-skeleton" />,
}));
vi.mock('@/widgets/options/OptionsAiAnalysisError', () => ({
    OptionsAiAnalysisError: () => <div data-testid="options-error" />,
}));

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareableAnalysisProvider, useShareable } from '@/features/share';
import { CongressTrendSummary } from '@/widgets/congress/CongressTrendSummary';
import { useCongressTrend } from '@/widgets/congress/hooks/useCongressTrend';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { useFinancialsAnalysis } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import { FundamentalAiSummary } from '@/widgets/fundamental/FundamentalAiSummary';
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { OptionsAiAnalysis } from '@/widgets/options/OptionsAiAnalysis';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { ChartContent } from '@/views/symbol/ChartContent';
import { useAnalysis } from '@/views/symbol/hooks/useAnalysis';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';

/**
 * 일곱 개 `useRegisterShareable` 호출부가 각자 위젯 상태에서 뽑은 `plain`을
 * 실제로 ShareableAnalysisContext까지 실어 나르는지 검증하는 배선 회귀.
 *
 * `useRegisterShareable`은 `ShareableAnalysisProvider`가 없으면 no-op한다
 * (`if (!register) return;`). 일곱 위젯의 기존 테스트 파일은 전부 이 Provider로
 * 감싸지 않고 `@/features/share`도 mock하지 않으므로, 호출부에서 `plain: null`로
 * 굳혀도 기존 테스트는 전부 초록이다(리뷰 라운드 2 지적, PR #778과 동일 패턴 —
 * docs/workflows/MISTAKES.md Tests §23). 여기서는 실제 Provider로 감싸고
 * `useShareable()`을 읽는 probe로 등록된 `plain`을 직접 관찰한다.
 */

const PLAIN = '쉽게 쓴 산문입니다.';

function PlainProbe() {
    const reg = useShareable();
    const label =
        reg?.plain === null
            ? 'NULL'
            : reg?.plain === undefined
              ? 'UNDEFINED'
              : reg.plain;
    return <div data-testid="probe-plain">{label}</div>;
}

function renderWithProbe(children: ReactNode) {
    render(
        <ShareableAnalysisProvider>
            {children}
            <PlainProbe />
        </ShareableAnalysisProvider>
    );
}

function expectRegisteredPlain(expected: string) {
    expect(screen.getByTestId('probe-plain').textContent).toBe(expected);
}

function expectRegisteredPlainNull() {
    expect(screen.getByTestId('probe-plain').textContent).toBe('NULL');
}

describe('공유 등록 plain 배선', () => {
    describe('CongressTrendSummary', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useCongressTrend).mockReturnValue({
                status: 'done',
                plain: PLAIN,
                result: {
                    overallSentiment: 'bullish',
                    summaryKo: '요약',
                    notableMembersKo: [],
                    riskNoteKo: '',
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<CongressTrendSummary symbol="AAPL" />);

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useCongressTrend).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<CongressTrendSummary symbol="AAPL" />);

            expectRegisteredPlainNull();
        });
    });

    describe('FinancialsAiSummary', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useFinancialsAnalysis).mockReturnValue({
                status: 'done',
                plain: PLAIN,
                result: {
                    overallSentiment: 'neutral',
                    overallConclusionKo: '결론',
                    axisAssessments: [],
                    riskFactorsKo: [],
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<FinancialsAiSummary symbol="AAPL" />);

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useFinancialsAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<FinancialsAiSummary symbol="AAPL" />);

            expectRegisteredPlainNull();
        });
    });

    describe('FundamentalAiSummary', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
                status: 'done',
                plain: PLAIN,
                result: {
                    overallSentiment: 'neutral',
                    overallConclusionKo: '결론',
                    categoryAssessments: [],
                    riskFactorsKo: [],
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<FundamentalAiSummary symbol="AAPL" />);

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            renderWithProbe(<FundamentalAiSummary symbol="AAPL" />);

            expectRegisteredPlainNull();
        });
    });

    describe('NewsAiSummary', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useNewsAnalysis).mockReturnValue({
                status: 'done',
                plain: PLAIN,
                result: {
                    overallSentiment: 'neutral',
                    currentDriverKo: '',
                    keyEventsKo: [],
                    upcomingEventsKo: [],
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <NewsAiSummary
                    symbol="AAPL"
                    companyName="Apple"
                    hasEnrichedNews={true}
                />
            );

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useNewsAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <NewsAiSummary
                    symbol="AAPL"
                    companyName="Apple"
                    hasEnrichedNews={true}
                />
            );

            expectRegisteredPlainNull();
        });
    });

    describe('OptionsAiAnalysis', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useOptionsAnalysis).mockReturnValue({
                status: 'done',
                plain: PLAIN,
                result: {
                    summary: '요약',
                    perExpiration: [],
                    signals: [],
                    analyzedAt: '2025-01-15T10:00:00Z',
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <OptionsAiAnalysis
                    symbol="AAPL"
                    companyName="Apple"
                    expirationDate="all"
                    modelId="deepseek-v4-flash"
                />
            );

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useOptionsAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <OptionsAiAnalysis
                    symbol="AAPL"
                    companyName="Apple"
                    expirationDate="all"
                    modelId="deepseek-v4-flash"
                />
            );

            expectRegisteredPlainNull();
        });
    });

    describe('OverallContent', () => {
        it('done 상태의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useOverallAnalysis).mockReturnValue({
                state: {
                    status: 'done',
                    plain: PLAIN,
                    result: {
                        headlineKo: '헤드라인',
                        technicalBulletsKo: [],
                        fundamentalBulletsKo: [],
                        newsBulletsKo: [],
                        optionsBulletsKo: [],
                        financialsBulletsKo: [],
                        integratedConclusionKo: '통합 결론',
                        scenarios: [],
                        riskFactorsKo: [],
                    },
                },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <OverallContent
                    symbol="AAPL"
                    companyName="Apple Inc."
                    hasEnrichedNews={true}
                    hasOptions={true}
                />
            );

            expectRegisteredPlain(PLAIN);
        });

        it('done이 아니면 null을 등록한다', () => {
            vi.mocked(useOverallAnalysis).mockReturnValue({
                state: { status: 'idle' },
                trigger: vi.fn(),
            } as never);

            renderWithProbe(
                <OverallContent
                    symbol="AAPL"
                    companyName="Apple Inc."
                    hasEnrichedNews={true}
                    hasOptions={true}
                />
            );

            expectRegisteredPlainNull();
        });
    });

    // ChartContent는 차트·훅 의존이 많아 전용 테스트(ChartContent.test.tsx)가
    // 이미 next/dynamic·useBars·useAnalysis 등 전체 트리를 mock한다. 같은 조합을
    // 재사용하되, `useAnalysis`가 반환하는 `plain`이 그대로 통과하는지만 여기서 덧붙여
    // 확인한다 — 다른 여섯 자리와 달리 ChartContent는 `state.status === 'done'`
    // 조건 없이 `plain`을 항상 그대로 전달하므로(useAnalysis 자체가 미완료 시 null을
    // 유지), "done이 아니면 null" 케이스는 useAnalysis가 null을 반환하는 것으로
    // 대체 검증한다.
    describe('ChartContent', () => {
        const defaultProps = {
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            timeframe: '1Day' as Timeframe,
            timeframeChangeCount: 0,
            initialAnalysis: {} as AnalysisResponse,
            initialAnalysisFailed: false,
            onMobileSheetContent: vi.fn(),
        };

        const baseAnalysisMock = {
            analysis: {} as AnalysisResponse,
            analysisResult: null,
            isAnalyzing: false,
            analysisError: null,
            isBotBlocked: false,
            handleReanalyze: vi.fn(),
            reanalyzeCooldownMs: 0,
            cooldownNotice: null,
        };

        it('useAnalysis의 plain을 공유 등록에 싣는다', () => {
            vi.mocked(useAnalysis).mockReturnValue({
                ...baseAnalysisMock,
                plain: PLAIN,
            } as never);

            renderWithProbe(<ChartContent {...defaultProps} />);

            expectRegisteredPlain(PLAIN);
        });

        it('useAnalysis의 plain이 null이면 null을 등록한다', () => {
            vi.mocked(useAnalysis).mockReturnValue({
                ...baseAnalysisMock,
                plain: null,
            } as never);

            renderWithProbe(<ChartContent {...defaultProps} />);

            expectRegisteredPlainNull();
        });
    });
});
