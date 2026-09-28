import { useQueryClient } from '@tanstack/react-query';
import { render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactQueryProvider } from '@/app/providers';

vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_STALE_TIME_MS: 5000,
    QUERY_GC_TIME_MS: 300000,
}));

const { SKEW, reloadOnVersionSkew, isVersionSkewError } = vi.hoisted(() => {
    class SkewError extends Error {}
    return {
        SKEW: new SkewError('skew'),
        reloadOnVersionSkew: vi.fn(),
        isVersionSkewError: vi.fn((error: unknown) => error === SKEW),
    };
});

vi.mock('@/shared/lib/reloadOnVersionSkew', () => ({
    reloadOnVersionSkew,
    isVersionSkewError,
}));

/** The QueryClient the provider creates, read through the real context. */
function renderProviderClient() {
    return renderHook(() => useQueryClient(), {
        wrapper: ReactQueryProvider,
    }).result.current;
}

describe('ReactQueryProvider', () => {
    beforeEach(() => {
        reloadOnVersionSkew.mockClear();
        isVersionSkewError.mockClear();
    });

    it('renders children inside QueryClientProvider', () => {
        render(
            <ReactQueryProvider>
                <div data-testid="child">test</div>
            </ReactQueryProvider>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders children text correctly', () => {
        render(
            <ReactQueryProvider>
                <span>Hello World</span>
            </ReactQueryProvider>
        );

        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('calls reloadOnVersionSkew when a query fails', () => {
        const client = renderProviderClient();

        client.getQueryCache().config.onError?.(SKEW, {} as never);

        expect(reloadOnVersionSkew).toHaveBeenCalledWith(SKEW);
    });

    it('calls reloadOnVersionSkew when a mutation fails', () => {
        const client = renderProviderClient();

        client
            .getMutationCache()
            .config.onError?.(
                SKEW,
                undefined,
                undefined,
                {} as never,
                {} as never
            );

        expect(reloadOnVersionSkew).toHaveBeenCalledWith(SKEW);
    });

    it('does not retry a version-skew error but retries others once', () => {
        const client = renderProviderClient();

        const retry = client.getDefaultOptions().queries?.retry as (
            failureCount: number,
            error: unknown
        ) => boolean;

        expect(retry(0, SKEW)).toBe(false);
        expect(retry(0, new Error('x'))).toBe(true);
        expect(retry(1, new Error('x'))).toBe(false);
    });
});
