import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BarsData } from '@y0ngha/siglens-core';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getBarsAction } from '@/entities/bars/actions';

const mockBars = vi.mocked(getBarsAction);

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getBarsAction with the same args and returns its data', async () => {
        const data = {
            bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
            indicators: {},
        } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        const result = await getBarsStatic('AAPL', '1Day', 'AAPL');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
    });
});
