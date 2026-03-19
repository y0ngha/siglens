import type { Bar } from '@/domain/types';

export type Pattern = {
  name: string;
  timestamp: string;
  direction: 'bullish' | 'bearish' | 'neutral';
};

export function detectPatterns(bars: Bar[]): Pattern[] {
  // TODO: implement
  void bars;
  return [];
}