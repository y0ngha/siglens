import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { calculateIndicators } from '@/domain/indicators';
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
    trendlines: [],
};

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;

    const market = new AlpacaProvider();

    const bars = await market.getBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        limit: DEFAULT_BARS_LIMIT,
    });

    const indicators = calculateIndicators(bars);

    return (
        <SymbolPageClient
            symbol={symbol}
            initialBars={bars}
            initialIndicators={indicators}
            initialAnalysis={FALLBACK_ANALYSIS}
            initialAnalysisFailed={true}
        />
    );
}
