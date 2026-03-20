import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { calculateMACD, calculateBollinger, calculateDMI } from '@/domain/indicators';
import { detectPatterns } from '@/domain/patterns';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { StockChart } from '@/components/chart/StockChart';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import type { IndicatorResult } from '@/domain/types';

type Props = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params;

  const market = new AlpacaProvider();
  const ai = new ClaudeProvider();

  const bars = await market.getBars({ symbol, timeframe: '1Min', limit: 500 });

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  const indicators: IndicatorResult = {
    macd: calculateMACD(closes),
    bollinger: calculateBollinger(closes),
    dmi: calculateDMI(highs, lows, closes),
    ma: {}, // TODO: #9 (MA 계산 구현) 완료 후 채워질 예정
    ema: {}, // TODO: #9 (EMA 계산 구현) 완료 후 채워질 예정
  };

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
