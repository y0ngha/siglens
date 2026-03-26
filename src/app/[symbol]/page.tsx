import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { calculateIndicators } from '@/domain/indicators';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import {
    DEFAULT_TIMEFRAME,
    DEFAULT_BARS_LIMIT,
} from '@/domain/constants/market';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;

    const market = new AlpacaProvider();
    const ai = new ClaudeProvider();
    const skillsLoader = new FileSkillsLoader();

    const [bars, skills] = await Promise.all([
        market.getBars({
            symbol,
            timeframe: DEFAULT_TIMEFRAME,
            limit: DEFAULT_BARS_LIMIT,
        }),
        skillsLoader.loadSkills().catch(() => []),
    ]);

    const indicators = calculateIndicators(bars);
    const prompt = buildAnalysisPrompt(symbol, bars, indicators, skills);
    const analysis = await ai.analyze(prompt);

    return (
        <SymbolPageClient
            symbol={symbol}
            initialBars={bars}
            initialIndicators={indicators}
            initialAnalysis={analysis}
        />
    );
}
