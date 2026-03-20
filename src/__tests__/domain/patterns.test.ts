import { detectPatterns } from '@/domain/patterns/detect';
import type { Bar } from '@/domain/types';

const makeBar = (i: number): Bar => ({
  time: 1700000000 + i * 60,
  open: 100 + i,
  high: 110 + i,
  low: 90 + i,
  close: 105 + i,
  volume: 1000,
});

describe('detectPatterns', () => {
  it('빈 bars 배열이면 빈 배열 반환', () => {
    expect(detectPatterns([])).toEqual([]);
  });

  it('bars가 있으면 PatternResult[] 반환', () => {
    const bars = Array.from({ length: 5 }, (_, i) => makeBar(i));
    const result = detectPatterns(bars);
    expect(Array.isArray(result)).toBe(true);
  });
});
