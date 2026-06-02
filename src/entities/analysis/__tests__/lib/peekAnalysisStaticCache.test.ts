import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisResponse } from '@y0ngha/siglens-core';

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

    it('delegates to peekAnalysisCache with the same args and returns its data', async () => {
        const cached = {
            summary: 'cached analysis',
        } as unknown as AnalysisResponse;
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
            'gemini-2.5-flash-lite'
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
            'gemini-2.5-flash-lite'
        );
    });
});
