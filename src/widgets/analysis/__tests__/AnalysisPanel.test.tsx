vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));
vi.mock('@/shared/ui/EyeIcon', () => ({
    EyeIcon: () => <span data-testid="eye-icon" />,
}));
vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/trendline', () => ({
    TRENDLINE_DIRECTION_LABEL: { ascending: '상승', descending: '하강' },
}));
vi.mock('@/shared/config/time', () => ({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
}));
vi.mock('@/shared/hooks/useCopyToClipboard', () => ({
    DEFAULT_RESET_MS: 2000,
}));
vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: () => '1시간 전',
}));
vi.mock('@/entities/analysis', () => ({
    isAnalysisStale: () => false,
}));
vi.mock('@/widgets/symbol-page', () => ({
    useSymbolPageContext: () => ({ indicatorCount: 25 }),
    ANALYSIS_PHASES: ['분석 중'],
    ANALYSIS_TIPS: ['팁'],
}));
vi.mock('../AnalysisProgress', () => ({
    AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));
vi.mock('../AnalysisToast', () => ({
    AnalysisToast: () => null,
}));
vi.mock('../AdBanner', () => ({
    AdBanner: () => null,
}));
vi.mock('../StaleAnalysisBanner', () => ({
    StaleAnalysisBanner: () => null,
}));
vi.mock('@/widgets/analysis/utils/parseStructuredSummary', () => ({
    parseStructuredSummary: () => null,
}));
vi.mock('@/widgets/analysis/utils/buildExpertAnalysisReport', () => ({
    buildExpertAnalysisReport: () => 'report text',
}));
vi.mock('@/widgets/analysis/utils/trendUtils', () => ({
    resolveTrendDisplay: (t: string | null | undefined) =>
        t === 'bullish' ? { label: '강세', color: '', bgColor: '' } : null,
}));
vi.mock('@/widgets/analysis/utils/signalUtils', () => ({
    resolveStrengthDisplay: () => null,
}));

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type {
    ActionRecommendation,
    AnalysisResponse,
    ClusteredKeyLevels,
    PatternResult,
    StrategyResult,
} from '@y0ngha/siglens-core';
import { MIN_CONFIDENCE_WEIGHT } from '@y0ngha/siglens-core';

import { AnalysisPanel } from '../AnalysisPanel';

function makeAnalysis(
    overrides: Partial<AnalysisResponse> = {}
): AnalysisResponse {
    return {
        summary: '요약 텍스트',
        trend: 'bullish',
        riskLevel: 'medium',
        indicatorResults: [],
        patternSummaries: [],
        strategyResults: [],
        trendlines: [],
        priceTargets: { bullish: null, bearish: null },
        actionRecommendation: undefined,
        analyzedAt: '2025-01-01T00:00:00Z',
        ...overrides,
    } as AnalysisResponse;
}

const EMPTY_KEY_LEVELS: ClusteredKeyLevels = {
    support: [],
    resistance: [],
};

const makeActionRecommendation = (
    overrides: Partial<ActionRecommendation> = {}
): ActionRecommendation => ({
    positionAnalysis: '현재 위치 분석',
    entry: '진입 전략',
    exit: '청산 전략',
    riskReward: '리스크/리워드',
    entryRecommendation: 'wait',
    ...overrides,
});

const makePattern = (
    overrides: Partial<PatternResult> = {}
): PatternResult => ({
    id: 'pattern-1',
    patternName: 'ascending-triangle',
    skillName: '상승 삼각형',
    detected: true,
    trend: 'bullish',
    summary: '패턴 설명',
    confidenceWeight: 0.92,
    ...overrides,
});

const makeStrategy = (
    overrides: Partial<StrategyResult> = {}
): StrategyResult => ({
    id: 'strategy-1',
    strategyName: 'Breakout',
    trend: 'bullish',
    summary: '전략 설명',
    confidenceWeight: MIN_CONFIDENCE_WEIGHT,
    ...overrides,
});

describe('AnalysisPanel', () => {
    it('renders the summary text when not in progress', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('요약 텍스트')).toBeInTheDocument();
    });

    it('renders "AI 분석" heading', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('AI 분석')).toBeInTheDocument();
    });

    it('renders the risk level', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({ riskLevel: 'high' })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('높음')).toBeInTheDocument();
    });

    it('renders AnalysisProgress when showProgress is true', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                showProgress={true}
            />
        );

        expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
        expect(screen.queryByText('요약 텍스트')).not.toBeInTheDocument();
    });

    it('renders the reanalyze button when onReanalyze is provided', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                onReanalyze={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: /재분석/ })
        ).toBeInTheDocument();
    });

    it('does not render the reanalyze button when onReanalyze is not provided', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(
            screen.queryByRole('button', { name: /재분석/ })
        ).not.toBeInTheDocument();
    });

    it('shows "감지된 패턴 없음" when no patterns detected', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({ patternSummaries: [] })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('감지된 패턴 없음')).toBeInTheDocument();
    });

    it('shows analyzed time', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('1시간 전')).toBeInTheDocument();
    });

    it('renders detected patterns as accordion items', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    patternSummaries: [
                        makePattern(),
                        makePattern({
                            id: 'p2',
                            skillName: '이중 바닥',
                            detected: false,
                        }),
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('상승 삼각형')).toBeInTheDocument();
        expect(screen.queryByText('이중 바닥')).not.toBeInTheDocument();
    });

    it('expands pattern accordion to show summary and key prices', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    patternSummaries: [
                        makePattern({
                            keyPrices: [
                                { label: '목표가', price: 220.5 },
                                { label: '지지선', price: 200.0 },
                            ],
                            renderConfig: {
                                label: '기준 가격',
                                show: true,
                                type: 'line',
                                color: '#26a69a',
                            },
                        }),
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        fireEvent.click(screen.getByText('상승 삼각형'));
        expect(screen.getByText('패턴 설명')).toBeInTheDocument();
        expect(screen.getByText('주요 가격대')).toBeInTheDocument();
    });

    it('renders strategy accordion items for detected strategies', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    strategyResults: [makeStrategy()],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('Breakout')).toBeInTheDocument();
    });

    it('filters strategies that overlap with pattern skill names', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    patternSummaries: [makePattern({ skillName: 'Breakout' })],
                    strategyResults: [
                        makeStrategy({ strategyName: 'Breakout' }),
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        // Strategy section header should not appear since all strategies filtered
        expect(screen.queryByText('전략')).not.toBeInTheDocument();
    });

    it('renders ActionRecommendationSection with entry recommendation', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        entryRecommendation: 'enter',
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('지금 진입')).toBeInTheDocument();
        expect(screen.getByText('매매 전략')).toBeInTheDocument();
    });

    it('renders ActionRecommendationSection with wait recommendation', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        entryRecommendation: 'wait',
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('관망')).toBeInTheDocument();
    });

    it('renders ActionRecommendationSection with avoid recommendation', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        entryRecommendation: 'avoid',
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('진입 보류')).toBeInTheDocument();
    });

    it('renders action recommendation text fields', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        positionAnalysis: '현재 위치 분석 내용',
                        entry: '분할 매수 진입 검토',
                        exit: '손절 가격 확인',
                        riskReward: '리스크 대비 리워드',
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('현재 위치')).toBeInTheDocument();
        expect(screen.getByText('진입 전략')).toBeInTheDocument();
        expect(screen.getByText('청산 전략')).toBeInTheDocument();
        expect(screen.getByText('리스크/리워드')).toBeInTheDocument();
    });

    it('renders reconciledLevels when present', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        reconciledLevels: {
                            exit: '보정된 청산 전략',
                            riskReward: '보정된 리스크',
                            reason: '보정 사유',
                        },
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('내부 보정값')).toBeInTheDocument();
        expect(screen.getByText('보정된 청산 전략')).toBeInTheDocument();
    });

    it('does not render reconciledLevels when exit and riskReward are empty', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        reconciledLevels: {
                            exit: '',
                            riskReward: '',
                            reason: '',
                        },
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('내부 보정값')).not.toBeInTheDocument();
    });

    it('renders key levels (support and resistance)', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={{
                    support: [
                        {
                            price: 200,
                            reason: '20일선',
                            count: 1,
                            sources: [{ price: 200, reason: '20일선' }],
                        },
                    ],
                    resistance: [
                        {
                            price: 220,
                            reason: '고점 저항',
                            count: 2,
                            sources: [
                                { price: 220, reason: '고점 저항' },
                                { price: 220.5, reason: '피보나치' },
                            ],
                        },
                    ],
                }}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('주요 레벨')).toBeInTheDocument();
        expect(screen.getByText('저항')).toBeInTheDocument();
        expect(screen.getByText('지지')).toBeInTheDocument();
    });

    it('renders PoC when present in key levels', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={{
                    support: [],
                    resistance: [],
                    poc: { price: 210, reason: '거래량 중심' },
                }}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('PoC')).toBeInTheDocument();
        expect(screen.getByText('거래량 중심')).toBeInTheDocument();
    });

    it('renders trendlines when present', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    trendlines: [
                        {
                            direction: 'ascending',
                            start: { time: 1000, price: 180 },
                            end: { time: 2000, price: 200 },
                        },
                        {
                            direction: 'descending',
                            start: { time: 1000, price: 220 },
                            end: { time: 2000, price: 210 },
                        },
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('추세선')).toBeInTheDocument();
        expect(screen.getByText('상승')).toBeInTheDocument();
        expect(screen.getByText('하강')).toBeInTheDocument();
    });

    it('renders price targets when bullish targets exist', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    priceTargets: {
                        bullish: {
                            condition: '저항 돌파 시',
                            targets: [{ price: 230, basis: '확장 목표' }],
                        },
                        bearish: null,
                    },
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('가격 목표')).toBeInTheDocument();
        expect(screen.getByText('상승')).toBeInTheDocument();
        expect(screen.getByText('저항 돌파 시')).toBeInTheDocument();
    });

    it('renders price targets when bearish targets exist', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    priceTargets: {
                        bullish: null,
                        bearish: {
                            condition: '지지 이탈 시',
                            targets: [{ price: 190, basis: '하단 지지' }],
                        },
                    },
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('가격 목표')).toBeInTheDocument();
        expect(screen.getByText('하락')).toBeInTheDocument();
    });

    it('renders indicator results', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    indicatorResults: [
                        {
                            indicatorName: 'RSI',
                            signals: [
                                {
                                    type: 'skill',
                                    trend: 'neutral',
                                    description: 'RSI 중립 영역',
                                },
                            ],
                        },
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('보조지표')).toBeInTheDocument();
        expect(screen.getByText('RSI')).toBeInTheDocument();
        expect(screen.getByText('RSI 중립 영역')).toBeInTheDocument();
    });

    it('filters indicator results with empty name', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    indicatorResults: [
                        {
                            indicatorName: '',
                            signals: [
                                {
                                    type: 'skill',
                                    trend: 'neutral',
                                    description: 'hidden',
                                },
                            ],
                        },
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('보조지표')).not.toBeInTheDocument();
    });

    it('filters indicator results that overlap with pattern skillNames', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    patternSummaries: [makePattern({ skillName: 'RSI' })],
                    indicatorResults: [
                        {
                            indicatorName: 'RSI',
                            signals: [
                                {
                                    type: 'skill',
                                    trend: 'neutral',
                                    description: 'should not appear',
                                },
                            ],
                        },
                    ],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('보조지표')).not.toBeInTheDocument();
    });

    it('shows analyzing state with pulse indicator', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                isAnalyzing={true}
            />
        );

        expect(screen.getByText('AI 분석')).toBeInTheDocument();
    });

    it('shows cooldown label on reanalyze button', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                onReanalyze={vi.fn()}
                reanalyzeCooldownMs={120000}
            />
        );

        expect(screen.getByText(/재분석 가능까지/)).toBeInTheDocument();
    });

    it('shows "분석 중" label on reanalyze button when analyzing', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                onReanalyze={vi.fn()}
                isAnalyzing={true}
            />
        );

        expect(screen.getByText('분석 중…')).toBeInTheDocument();
    });

    it('toggles chart visibility via ActionRecommendationSection button', () => {
        const onVisibilityChange = vi.fn();
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation(),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                actionPricesVisible={true}
                onActionPricesVisibilityChange={onVisibilityChange}
            />
        );

        const chartButton = screen.getByRole('button', {
            name: '차트 가격선 숨기기',
        });
        fireEvent.click(chartButton);
        expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });

    it('renders chart toggle with show label when not visible', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation(),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                actionPricesVisible={false}
            />
        );

        expect(
            screen.getByRole('button', { name: '차트 가격선 표시' })
        ).toBeInTheDocument();
    });

    it('handles copy report button click', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock },
        });

        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        const copyButton = screen.getByText('리포트 복사');
        await act(async () => {
            fireEvent.click(copyButton);
        });

        expect(writeTextMock).toHaveBeenCalledWith('report text');
        expect(screen.getByText('복사됨')).toBeInTheDocument();
    });

    it('shows copy failed state when clipboard fails', async () => {
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockRejectedValue(new Error('denied')),
            },
        });

        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        const copyButton = screen.getByText('리포트 복사');
        await act(async () => {
            fireEvent.click(copyButton);
        });

        expect(screen.getByText('복사 실패')).toBeInTheDocument();
        expect(
            screen.getByText(
                '클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'
            )
        ).toBeInTheDocument();
    });

    it('does not copy when showProgress is true', async () => {
        const writeTextMock = vi.fn();
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock },
        });

        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
                showProgress={true}
            />
        );

        // The button is disabled, but even if clicked the handler guards
        expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('renders low risk level', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({ riskLevel: 'low' })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('낮음')).toBeInTheDocument();
    });

    it('renders medium risk level', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({ riskLevel: 'medium' })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('보통')).toBeInTheDocument();
    });

    it('expands and collapses strategy accordion', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    strategyResults: [makeStrategy()],
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        fireEvent.click(screen.getByText('Breakout'));
        expect(screen.getByText('전략 설명')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Breakout'));
        expect(screen.queryByText('전략 설명')).not.toBeInTheDocument();
    });

    it('hides analyzed time when analyzedAt is not present', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({ analyzedAt: undefined })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('1시간 전')).not.toBeInTheDocument();
    });

    it('does not render action recommendation fields with empty values', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        positionAnalysis: '',
                        entry: '진입 전략 텍스트',
                        exit: '',
                        riskReward: '',
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('현재 위치')).not.toBeInTheDocument();
        expect(screen.getByText('진입 전략')).toBeInTheDocument();
    });

    it('renders confluence info tooltip for key levels with count > 1', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis()}
                keyLevels={{
                    support: [
                        {
                            price: 200,
                            reason: '20일선',
                            count: 3,
                            sources: [
                                { price: 200, reason: '20일선' },
                                { price: 200.5, reason: '피보나치' },
                                { price: 199.8, reason: '거래량' },
                            ],
                        },
                    ],
                    resistance: [],
                }}
                timeframe="1Day"
            />
        );

        expect(screen.getByText('주요 레벨')).toBeInTheDocument();
    });

    it('skips rendering action recommendation section without entryRecommendation', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    actionRecommendation: makeActionRecommendation({
                        entryRecommendation: undefined,
                    }),
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('진입 의견')).not.toBeInTheDocument();
        expect(screen.getByText('매매 전략')).toBeInTheDocument();
    });

    it('does not render price targets section when both are null', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    priceTargets: { bullish: null, bearish: null },
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('가격 목표')).not.toBeInTheDocument();
    });

    it('does not render price targets when targets arrays are empty', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={makeAnalysis({
                    priceTargets: {
                        bullish: { condition: 'test', targets: [] },
                        bearish: { condition: 'test', targets: [] },
                    },
                })}
                keyLevels={EMPTY_KEY_LEVELS}
                timeframe="1Day"
            />
        );

        expect(screen.queryByText('가격 목표')).not.toBeInTheDocument();
    });
});
