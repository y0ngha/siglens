import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { calculateIndicators } from '@/domain/indicators';
import { detectPatterns } from '@/domain/patterns';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { StockChart } from '@/components/chart/StockChart';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';

type Props = {
    params: Promise<{ symbol: string }>;
};

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;

    const market = new AlpacaProvider();
    const ai = new ClaudeProvider();

    const bars = await market.getBars({
        symbol,
        timeframe: '1Min',
        limit: 500,
    });

    const indicators = calculateIndicators(bars);

    const patterns = detectPatterns(bars);

    const prompt = buildAnalysisPrompt(symbol, bars, indicators, patterns);

    const analysis = await ai.analyze(prompt);

    return (
        <main>
            <h1>{symbol}</h1>
            <StockChart initialBars={bars} />
            <AnalysisPanel initialAnalysis={analysis} />
        </main>
    );
}
