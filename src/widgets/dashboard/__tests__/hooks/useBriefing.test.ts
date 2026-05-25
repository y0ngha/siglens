// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useBriefing } from '@/widgets/dashboard/hooks/useBriefing';
import { pollBriefingAction } from '@/entities/analysis/actions';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';

vi.mock('@/entities/analysis/actions', () => ({
    pollBriefingAction: vi.fn(),
}));

const mockPoll = pollBriefingAction as ReturnType<typeof vi.fn>;

const BRIEFING: MarketBriefingResponse = {
    summary: 'Market looks bullish',
    dominantThemes: ['AI'],
    sectorAnalysis: {
        leadingSectors: ['XLK'],
        laggingSectors: [],
        performanceDescription: '',
    },
    volatilityAnalysis: { vixLevel: 15, description: 'low' },
    riskSentiment: 'risk on',
};

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

describe('useBriefing', () => {
    afterEach(() => {
        mockPoll.mockReset();
    });

    it('returns processing when poll returns processing', () => {
        mockPoll.mockResolvedValue({ status: 'processing' });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useBriefing('job-1'), { wrapper });
        expect(result.current.status).toBe('processing');
        client.clear();
    });

    it('returns done with briefing when poll returns done', async () => {
        mockPoll.mockResolvedValue({
            status: 'done',
            briefing: BRIEFING,
            generatedAt: '2025-01-01T00:00:00Z',
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useBriefing('job-1'), { wrapper });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        const state = result.current;
        if (state.status !== 'done') throw new Error('expected done');
        expect(state.briefing).toEqual(BRIEFING);
        expect(state.generatedAt).toBe('2025-01-01T00:00:00Z');
        client.clear();
    });

    it('throws when poll returns error', async () => {
        mockPoll.mockResolvedValue({
            status: 'error',
            error: 'Server failure',
        });
        const { client, wrapper } = makeWrapper();

        const { result } = renderHook(() => useBriefing('job-err'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('processing');
        });
        client.clear();
    });
});
