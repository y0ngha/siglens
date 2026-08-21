// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useMarketBriefing } from '@/widgets/dashboard/hooks/useMarketBriefing';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import type { MarketBriefingActionResult } from '@/shared/lib/types';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

const mockAction = runAnalysisStream as ReturnType<typeof vi.fn>;

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(
                QueryClientProvider,
                { client },
                // node 프로젝트는 vitest.setup.dom의 전역 intl 래핑이 걸리지 않는다.
                createElement(IntlTestProvider, null, children)
            ),
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

const DONE_BRIEFING_RESULT: MarketBriefingActionResult = {
    briefing: {
        status: 'done',
        briefing: {
            summary: 'AI market overview done',
            sectors: [],
            volatility: null,
        } as unknown as MarketBriefingResponse,
        generatedAt: '2025-01-01T11:00:00Z',
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
        const { result } = renderHook(
            () => useMarketBriefing('us', PEEK_SEED),
            {
                wrapper,
            }
        );
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
        const { result } = renderHook(() => useMarketBriefing('us', null), {
            wrapper,
        });
        expect(result.current.input).toBeUndefined();
        client.clear();
    });

    it('(Happy) peekSeed 없음 + 미hydrated → undefined', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });
        expect(result.current.input).toBeUndefined();
        client.clear();
    });

    it('(Happy) action done (cached) → input = cached briefing', async () => {
        mockAction.mockResolvedValue(CACHED_BRIEFING_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.input).toMatchObject({
                status: 'cached',
                briefing: expect.anything(),
                generatedAt: '2025-01-01T10:00:00Z',
            });
        });
        // type 문자열이 잘못되면 SSE 라우트가 400을 반환한다 — 프로덕션 버그를 테스트에서 잡는다.
        expect(mockAction).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'briefing' })
        );
        client.clear();
    });

    it('(Happy) action done (done) → input = done briefing', async () => {
        mockAction.mockResolvedValue(DONE_BRIEFING_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.input).toMatchObject({
                status: 'done',
                generatedAt: '2025-01-01T11:00:00Z',
            });
        });
        client.clear();
    });

    it('(Worst) botBlocked인데 seed가 있으면 seed를 보여 준다 (색인 텍스트 보존)', async () => {
        // Googlebot WRS 렌더에서 이 fetch는 봇으로 판정된다. seed를 버리면 SSR HTML에
        // 있던 브리핑이 렌더된 DOM에서 안내문으로 교체돼 색인 대상 텍스트가 사라진다.
        const PEEK = { headlineKo: '시드 브리핑' } as never;
        mockAction.mockResolvedValue({ briefing: null, botBlocked: true });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us', PEEK), {
            wrapper,
        });

        await waitFor(() => expect(mockAction).toHaveBeenCalled());
        expect(result.current.input).toMatchObject({ status: 'cached' });
        client.clear();
    });

    it('(Worst) botBlocked → input null', async () => {
        const botResult: MarketBriefingActionResult = {
            briefing: null,
            botBlocked: true,
        };
        mockAction.mockResolvedValue(botResult);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.input).toBeNull();
        });
        client.clear();
    });

    it("(Worst) action {ok:false} → input 'error'", async () => {
        const errorResult: MarketBriefingActionResult = {
            ok: false,
            error: 'server_error',
        };
        mockAction.mockResolvedValue(errorResult);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.input).toBe('error');
        });
        client.clear();
    });

    it('(Worst) 스트림이 throw해도 peekSeed가 있으면 seed를 계속 보여 준다', async () => {
        // seed는 서버 peek로 읽은 실제 캐시 본문이다 — 에러 카드보다 낫다.
        const PEEK = { headlineKo: '시드 브리핑' } as never;
        mockAction.mockRejectedValue(new Error('분석 시간이 초과되었습니다.'));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us', PEEK), {
            wrapper,
        });

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalled();
        });
        expect(result.current.input).toMatchObject({ status: 'cached' });
        client.clear();
    });

    it("(Worst) 스트림이 throw하고 seed도 없으면 input 'error' — 스켈레톤이 영원히 남지 않는다", async () => {
        // SSE가 error 이벤트로 끝나면 runAnalysisStream이 throw한다. 이때 data가
        // 없어 seedInput(undefined)으로 떨어지면 실패가 조용히 사라진다.
        mockAction.mockRejectedValue(new Error('분석 시간이 초과되었습니다.'));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketBriefing('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.input).toBe('error');
        });
        client.clear();
    });
});
