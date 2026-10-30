/**
 * Tests for useMarketNewsAnalysisTrigger — 수집·보강 요청을 token(category:attempt)당 한 번만 보낸다.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { ensureMarketNewsCardsAnalyzedAction } from '@/entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { useMarketNewsAnalysisTrigger } from '@/widgets/market-news/hooks/useMarketNewsAnalysisTrigger';

vi.mock(
    '@/entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction',
    () => ({
        ensureMarketNewsCardsAnalyzedAction: vi.fn(),
    })
);

const mockEnsure = ensureMarketNewsCardsAnalyzedAction as MockedFunction<
    typeof ensureMarketNewsCardsAnalyzedAction
>;

interface Props {
    category: NewsFeedCategoryId;
    attempt: number;
}

describe('useMarketNewsAnalysisTrigger', () => {
    beforeEach(() => {
        mockEnsure.mockReset();
        mockEnsure.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('마운트 때 카테고리로 한 번 요청한다', () => {
        renderHook(() => useMarketNewsAnalysisTrigger('crypto', 0));

        expect(mockEnsure).toHaveBeenCalledTimes(1);
        expect(mockEnsure).toHaveBeenCalledWith('crypto');
    });

    it('같은 category·attempt로 리렌더해도 다시 요청하지 않는다', () => {
        const { rerender } = renderHook(
            ({ category, attempt }: Props) =>
                useMarketNewsAnalysisTrigger(category, attempt),
            { initialProps: { category: 'crypto', attempt: 0 } as Props }
        );

        rerender({ category: 'crypto', attempt: 0 });
        rerender({ category: 'crypto', attempt: 0 });

        expect(mockEnsure).toHaveBeenCalledTimes(1);
    });

    it('StrictMode의 effect 이중 실행에도 같은 token은 한 번만 요청한다', () => {
        renderHook(() => useMarketNewsAnalysisTrigger('crypto', 0), {
            reactStrictMode: true,
        });

        expect(mockEnsure).toHaveBeenCalledTimes(1);
    });

    it('attempt가 오르면 다시 요청한다', () => {
        const { rerender } = renderHook(
            ({ category, attempt }: Props) =>
                useMarketNewsAnalysisTrigger(category, attempt),
            { initialProps: { category: 'crypto', attempt: 0 } as Props }
        );

        rerender({ category: 'crypto', attempt: 1 });

        expect(mockEnsure).toHaveBeenCalledTimes(2);
        expect(mockEnsure).toHaveBeenNthCalledWith(2, 'crypto');
    });

    it('category가 바뀌면 새 카테고리로 요청한다', () => {
        const { rerender } = renderHook(
            ({ category, attempt }: Props) =>
                useMarketNewsAnalysisTrigger(category, attempt),
            { initialProps: { category: 'crypto', attempt: 0 } as Props }
        );

        rerender({ category: 'general', attempt: 0 });

        expect(mockEnsure).toHaveBeenCalledTimes(2);
        expect(mockEnsure).toHaveBeenLastCalledWith('general');
    });

    it('요청이 실패하면 console.error로 남기고 던지지 않는다', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const failure = new Error('boom');
        mockEnsure.mockRejectedValue(failure);

        renderHook(() => useMarketNewsAnalysisTrigger('crypto', 0));
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());

        expect(consoleError).toHaveBeenCalledWith(
            '[useMarketNewsAnalysisTrigger] ensureMarketNewsCardsAnalyzedAction failed:',
            failure
        );
    });
});
