import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@y0ngha/siglens-core', () => ({
    peekAnalysisCache: vi.fn(),
}));

import { peekAnalysisStatic } from '@/entities/analysis/lib/peekAnalysisStaticCache';
import { peekAnalysisCache } from '@y0ngha/siglens-core';

const mockPeek = vi.mocked(peekAnalysisCache);

describe('peekAnalysisStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses the free-tier peek and returns its data', async () => {
        const cached = {
            result: { summary: 'cached analysis' } as never,
            lockedInfoDepth: [],
        };
        mockPeek.mockResolvedValue(cached);

        const result = await peekAnalysisStatic(
            'AAPL',
            '1Day',
            'AAPL',
            'gemini-2.5-flash-lite'
        );

        expect(result).toBe(cached);
        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'AAPL',
            'gemini-2.5-flash-lite',
            false,
            'free'
        );
    });

    it('passes a cache miss (null) straight through', async () => {
        mockPeek.mockResolvedValue(null);

        const result = await peekAnalysisStatic(
            'AAPL',
            '1Day',
            undefined,
            'gemini-2.5-flash-lite'
        );

        expect(result).toBeNull();
        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            'gemini-2.5-flash-lite',
            false,
            'free'
        );
    });

    it('always peeks the reasoning-OFF key (member-reasoning-toggle spec Part A.4)', async () => {
        mockPeek.mockResolvedValue(null);

        await peekAnalysisStatic(
            'AAPL',
            '1Day',
            undefined,
            'deepseek-v4-flash'
        );

        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            'deepseek-v4-flash',
            false,
            'free'
        );
    });
});
