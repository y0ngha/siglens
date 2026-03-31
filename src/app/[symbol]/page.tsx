import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { createAIProvider } from '@/infrastructure/ai/factory';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { calculateIndicators } from '@/domain/indicators';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import {
    DEFAULT_TIMEFRAME,
    DEFAULT_BARS_LIMIT,
} from '@/domain/constants/market';
import type { AnalysisResponse } from '@/domain/types';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';

const FALLBACK_ANALYSIS: AnalysisResponse = {
    summary: 'AI 분석을 일시적으로 사용할 수 없습니다.',
    trend: 'neutral',
    signals: [],
    skillSignals: [],
    riskLevel: 'medium',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
};

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;

    const market = new AlpacaProvider();
    const ai = createAIProvider();
    const skillsLoader = new FileSkillsLoader();

    const [bars, skills] = await Promise.all([
        market.getBars({
            symbol,
            timeframe: DEFAULT_TIMEFRAME,
            limit: DEFAULT_BARS_LIMIT,
        }),
        skillsLoader.loadSkills().catch((error: unknown) => {
            console.error('Skills load failed', error);
            return [];
        }),
    ]);

    const indicators = calculateIndicators(bars);
    const prompt = buildAnalysisPrompt(symbol, bars, indicators, skills);
    const rawAnalysis = await ai.analyze(prompt).catch(() => null);
    const analysisFailed = rawAnalysis === null;
    const analysis = analysisFailed
        ? FALLBACK_ANALYSIS
        : enrichAnalysisWithConfidence(rawAnalysis, skills);

    return (
        <SymbolPageClient
            symbol={symbol}
            initialBars={bars}
            initialIndicators={indicators}
            initialAnalysis={analysis}
            initialAnalysisFailed={analysisFailed}
        />
    );
}
