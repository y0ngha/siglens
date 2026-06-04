// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useMarketBriefing } from '@/widgets/dashboard/hooks/useMarketBriefing';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions';
import type { MarketBriefingActionResult } from '@/shared/lib/types';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';

vi.mock('@/entities/market-summary/actions', () => ({
    submitMarketBriefingAction: vi.fn(),
}));

const mockAction = submitMarketBriefingAction as ReturnType<typeof vi.fn>;

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
    };
}

const CACHED_BRIEFING_RESULT: MarketBriefingActionResult = {
    briefing: {
        status: 'cached',
        briefing: {
            summary: 'AI market overview',
            sectors: [],
            volatility: null,
        } as unknown as MarketBriefingResponse,
        generatedAt: '2025-01-01T10:00:00Z',
    },
    botBlocked: false,
};

const SUBMITTED_BRIEFING_RESULT: MarketBriefingActionResult = {
    briefing: {
        status: 'submitted',
        jobId: 'job-123',
    },
    botBlocked: false,
};

const PEEK_SEED: MarketBriefingResponse = {
    summary: 'Seeded market overview',
    sectors: [],
    volatility: null,
} as unknown as MarketBriefingResponse;

describe('useMarketBriefing', () => {
    afterEach(() => {
        mockAction.mockReset();
    });

    it('(Happy) peekSeed 있음 → 초기 input cached로 즉시 노출', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(PEEK_SEED), {
            wrapper,
        });
        // data=undefined(미hydrated) + peekSeed 있음 → cached 형태로 노출
        expect(result.current.input).toMatchObject({
            status: 'cached',
            briefing: PEEK_SEED,
        });
        client.clear();
    });

    it('(Happy) peekSeed null + 미hydrated → undefined', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(null), {
            wrapper,
        });
        expect(result.current.input).toBeUndefined();
        client.clear();
    });

    it('(Happy) peekSeed 없음 + 미hydrated → undefined', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(), { wrapper });
        expect(result.current.input).toBeUndefined();
        client.clear();
    });

    it('(Happy) action done (cached) → input = cached briefing', async () => {
        mockAction.mockResolvedValue(CACHED_BRIEFING_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(), { wrapper });

        await waitFor(() => {
            expect(result.current.input).toMatchObject({
                status: 'cached',
                briefing: expect.anything(),
                generatedAt: '2025-01-01T10:00:00Z',
            });
        });
        client.clear();
    });

    it('(Happy) action done (submitted) → input = submitted briefing', async () => {
        mockAction.mockResolvedValue(SUBMITTED_BRIEFING_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(), { wrapper });

        await waitFor(() => {
            expect(result.current.input).toMatchObject({
                status: 'submitted',
                jobId: 'job-123',
            });
        });
        client.clear();
    });

    it('(Worst) botBlocked → input null', async () => {
        const botResult: MarketBriefingActionResult = {
            briefing: null,
            botBlocked: true,
        };
        mockAction.mockResolvedValue(botResult);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(), { wrapper });

        await waitFor(() => {
            expect(result.current.input).toBeNull();
        });
        client.clear();
    });

    it('(Worst) action {ok:false} → input undefined (렌더 안 함)', async () => {
        const errorResult: MarketBriefingActionResult = {
            ok: false,
            error: 'server_error',
        };
        mockAction.mockResolvedValue(errorResult);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing(), { wrapper });

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalled();
        });
        expect(result.current.input).toBeUndefined();
        client.clear();
    });
});
