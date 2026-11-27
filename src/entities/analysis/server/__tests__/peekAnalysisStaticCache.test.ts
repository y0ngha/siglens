vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    peekAnalysisCache: vi.fn(),
}));

import { peekAnalysisCache } from '@y0ngha/siglens-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { peekAnalysisStatic } from '@/entities/analysis/server/peekAnalysisStaticCache';

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
            'gemini-3.5-flash-lite',
            'ko',
            'SPY'
        );

        expect(result).toBe(cached);
        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'AAPL',
            'gemini-3.5-flash-lite',
            false,
            'free',
            undefined,
            undefined,
            'ko',
            { benchmarkSymbol: 'SPY' }
        );
    });

    it('passes a cache miss (null) straight through', async () => {
        mockPeek.mockResolvedValue(null);

        const result = await peekAnalysisStatic(
            'AAPL',
            '1Day',
            undefined,
            'gemini-3.5-flash-lite',
            'ko',
            undefined
        );

        expect(result).toBeNull();
        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            'gemini-3.5-flash-lite',
            false,
            'free',
            undefined,
            undefined,
            'ko',
            { benchmarkSymbol: undefined }
        );
    });

    it('always peeks the reasoning-OFF key (member-reasoning-toggle spec Part A.4)', async () => {
        mockPeek.mockResolvedValue(null);

        await peekAnalysisStatic(
            'AAPL',
            '1Day',
            undefined,
            'deepseek-v4.1-flash',
            'ko',
            undefined
        );

        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            'deepseek-v4.1-flash',
            false,
            'free',
            undefined,
            undefined,
            'ko',
            { benchmarkSymbol: undefined }
        );
    });

    it('passes the caller-resolved locale through to peekAnalysisCache', async () => {
        mockPeek.mockResolvedValue(null);

        await peekAnalysisStatic(
            'AAPL',
            '1Day',
            undefined,
            'gemini-3.5-flash-lite',
            'ja',
            undefined
        );

        expect(mockPeek).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            'gemini-3.5-flash-lite',
            false,
            'free',
            undefined,
            undefined,
            'ja',
            { benchmarkSymbol: undefined }
        );
    });

    it('인자로 받은 benchmarkSymbol을 peek 옵션으로 그대로 넘긴다(writer의 :bm= 키와 맞추기 위해)', async () => {
        mockPeek.mockResolvedValue(null);

        await peekAnalysisStatic(
            '005930.KS',
            '1Day',
            undefined,
            'deepseek-v4.1-flash',
            'ko',
            'KS11'
        );

        expect(mockPeek).toHaveBeenCalledWith(
            '005930.KS',
            '1Day',
            undefined,
            'deepseek-v4.1-flash',
            false,
            'free',
            undefined,
            undefined,
            'ko',
            { benchmarkSymbol: 'KS11' }
        );
    });
});
