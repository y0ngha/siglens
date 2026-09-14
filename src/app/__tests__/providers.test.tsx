import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

let capturedClient: ReturnType<typeof useQueryClient> | undefined;
function ClientCapture() {
    capturedClient = useQueryClient();
    return null;
}

describe('ReactQueryProvider', () => {
    beforeEach(() => {
        capturedClient = undefined;
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
        render(
            <ReactQueryProvider>
                <ClientCapture />
            </ReactQueryProvider>
        );

        capturedClient?.getQueryCache().config.onError?.(SKEW, {} as never);

        expect(reloadOnVersionSkew).toHaveBeenCalledWith(SKEW);
    });

    it('calls reloadOnVersionSkew when a mutation fails', () => {
        render(
            <ReactQueryProvider>
                <ClientCapture />
            </ReactQueryProvider>
        );

        capturedClient
            ?.getMutationCache()
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
        render(
            <ReactQueryProvider>
                <ClientCapture />
            </ReactQueryProvider>
        );

        const retry = capturedClient?.getDefaultOptions().queries?.retry as (
            failureCount: number,
            error: unknown
        ) => boolean;

        expect(retry(0, SKEW)).toBe(false);
        expect(retry(0, new Error('x'))).toBe(true);
        expect(retry(1, new Error('x'))).toBe(false);
    });
});
