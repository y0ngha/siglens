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
import { render, screen } from '@testing-library/react';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
} from '@y0ngha/siglens-core';

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
});
