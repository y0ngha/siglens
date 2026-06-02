// @vitest-environment jsdom
const ensureSpy = vi.hoisted(() => vi.fn());
vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: ensureSpy,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNewsAnalysisTrigger } from '@/widgets/news/hooks/useNewsAnalysisTrigger';

describe('useNewsAnalysisTrigger', () => {
    beforeEach(() => {
        ensureSpy.mockReset();
        ensureSpy.mockResolvedValue(undefined);
    });

    it('마운트 시 해당 symbol로 ensureNewsCardsAnalyzedAction을 1회 호출한다', () => {
        renderHook(() => useNewsAnalysisTrigger('AAPL'));

        expect(ensureSpy).toHaveBeenCalledTimes(1);
        expect(ensureSpy).toHaveBeenCalledWith('AAPL');
    });

    it('같은 symbol로 재렌더 시 재호출하지 않는다 (ref 가드 — StrictMode 이중 마운트 방지)', () => {
        const { rerender } = renderHook(({ s }) => useNewsAnalysisTrigger(s), {
            initialProps: { s: 'AAPL' },
        });

        rerender({ s: 'AAPL' });

        expect(ensureSpy).toHaveBeenCalledTimes(1);
    });

    it('symbol이 바뀌면(언마운트 없이) 새 symbol로 다시 호출한다', () => {
        const { rerender } = renderHook(({ s }) => useNewsAnalysisTrigger(s), {
            initialProps: { s: 'AAPL' },
        });

        rerender({ s: 'TSLA' });

        expect(ensureSpy).toHaveBeenCalledTimes(2);
        expect(ensureSpy).toHaveBeenNthCalledWith(1, 'AAPL');
        expect(ensureSpy).toHaveBeenNthCalledWith(2, 'TSLA');
    });

    it('액션이 reject해도 throw하지 않고 에러를 로깅한다(fire-and-forget)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        ensureSpy.mockRejectedValue(new Error('boom'));

        renderHook(() => useNewsAnalysisTrigger('AAPL'));

        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        errorSpy.mockRestore();
    });
});
