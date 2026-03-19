import type { Bar } from '@/domain/types';
import type { Pattern } from '@/domain/patterns/detect';

export type IndicatorSnapshot = {
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollinger?: { upper: number; middle: number; lower: number };
  adx?: number;
  vwap?: number;
};

export function buildAnalysisPrompt(
  symbol: string,
  bars: Bar[],
  indicators: IndicatorSnapshot,
  patterns: Pattern[],
): string {
  // TODO: implement
  void symbol;
  void bars;
  void indicators;
  void patterns;
  return '';
}