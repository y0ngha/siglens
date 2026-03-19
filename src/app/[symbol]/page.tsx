import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { calculateRSI, calculateMACD, calculateBollinger, calculateDMI, calculateVWAP } from '@/domain/indicators';
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

  const bars = await market.getBars({ symbol, timeframe: '1Min', limit: 500 });

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollinger = calculateBollinger(closes);
  const dmi = calculateDMI(highs, lows, closes);
  const vwap = calculateVWAP(highs, lows, closes, volumes);

  const patterns = detectPatterns(bars);

  const prompt = buildAnalysisPrompt(
    symbol,
    bars,
    {
      rsi: rsi.at(-1)?.value,
      macd: macd.at(-1),
      bollinger: bollinger.at(-1),
      adx: dmi.at(-1)?.adx,
      vwap: vwap.at(-1)?.value,
    },
    patterns,
  );

  const analysis = await ai.analyze(prompt);

  return (
    <main>
      <h1>{symbol}</h1>
      <StockChart initialBars={bars} />
      <AnalysisPanel initialAnalysis={analysis} />
    </main>
  );
}