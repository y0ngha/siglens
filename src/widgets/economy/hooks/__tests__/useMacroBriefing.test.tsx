vi.mock('@/shared/hooks/useAnalysisStream');
vi.mock('@/shared/hooks/useHydrated');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { useMacroBriefing } from '@/widgets/economy/hooks/useMacroBriefing';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { useHydrated } from '@/shared/hooks/useHydrated';

const mockSubmit = vi.mocked(runAnalysisStream);
const mockUseHydrated = vi.mocked(useHydrated);

const PEEK: MacroBriefingResponse = {
    summary: 'peek summary',
    highlights: [],
    regime: 'neutral',
};

interface WrapperProps {
    children: React.ReactNode;
}

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function QueryWrapper({ children }: WrapperProps) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useMacroBriefing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHydrated.mockReturnValue(true);
    });

    it('peekSeed가 있으면 hydrate 이전엔 cached seedInput으로 노출 (generatedAt=null)', async () => {
        mockUseHydrated.mockReturnValueOnce(false);
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });
        expect(result.current.input).toEqual({
            status: 'cached',
            briefing: PEEK,
            generatedAt: null,
        });
    });

    it('peekSeed가 없고 data 미도착이면 undefined', () => {
        mockSubmit.mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        expect(result.current.input).toBeUndefined();
    });

    it('action이 cached briefing 반환 → input=briefing', async () => {
        mockSubmit.mockResolvedValue({
            briefing: {
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            },
            botBlocked: false,
        });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() =>
            expect(result.current.input).toEqual({
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            })
        );
        // type 문자열이 잘못되면 SSE 라우트가 400을 반환한다 — 프로덕션 버그를 테스트에서 잡는다.
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'macroBriefing' })
        );
    });

    it('action이 done 반환 → input=done variant', async () => {
        mockSubmit.mockResolvedValue({
            briefing: {
                status: 'done',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            },
            botBlocked: false,
        });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() =>
            expect(result.current.input).toEqual({
                status: 'done',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            })
        );
    });

    it('botBlocked → input=null', async () => {
        mockSubmit.mockResolvedValue({ briefing: null, botBlocked: true });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.input).toBeNull());
    });

    it('action ok=false → input="error" (silent skeleton 회귀 방지)', async () => {
        mockSubmit.mockResolvedValue({ ok: false, error: 'server_error' });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.input).toBe('error'));
    });

    // M2: mount-only 호출 검증 — useQuery + staleTime:Infinity가 re-render에서 재호출 차단
    it('useMacroBriefing은 mount 당 submitMacroBriefingAction을 1회만 호출한다 (re-render 무관)', async () => {
        mockSubmit.mockResolvedValue({
            briefing: {
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            },
            botBlocked: false,
        });
        const { result, rerender } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        // action이 완료될 때까지 대기
        await waitFor(() => expect(result.current.input).not.toBeUndefined());
        // 여러 번 re-render
        rerender();
        rerender();
        rerender();
        // 여전히 1회만 호출되어야 한다 (staleTime:Infinity로 QueryClient 캐시 재사용)
        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('peekSeed 잔존 + action error 도착 → seed를 계속 보여 준다', async () => {
        /**
         * 예전엔 여기서 'error'로 교체하는 게 맞다고 봤다("stale seed를 계속 보여주지
         * 말 것"). SEO 감사에서 그 판단이 뒤집혔다 — seed는 서버가 peek로 읽어 온
         * **실제 캐시 본문**이고, 이걸 버리면 Googlebot WRS가 렌더한 DOM에서 이 페이지의
         * 유일한 AI 서술이 안내문으로 교체돼 색인 대상 텍스트가 사라진다.
         *
         * "오래됨"은 seed variant의 `generatedAt: null`로 이미 표현된다(뷰가 타임스탬프를
         * 표시하지 않는다) — 신선한 척하지 않으면서 내용은 지키는 쪽이 맞다.
         */
        mockSubmit.mockResolvedValue({ ok: false, error: 'server_error' });
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
        expect(result.current.input).toMatchObject({ status: 'cached' });
    });

    it('봇 차단 응답이어도 seed가 있으면 seed를 보여 준다 (색인 텍스트 보존)', async () => {
        mockSubmit.mockResolvedValue({ briefing: null, botBlocked: true });
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
        expect(result.current.input).toMatchObject({ status: 'cached' });
    });

    it('봇 차단이고 seed도 없으면 봇 안내를 노출한다', async () => {
        mockSubmit.mockResolvedValue({ briefing: null, botBlocked: true });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.input).toBeNull());
    });

    // 스트림 throw(SSE error 이벤트) — data가 없어 seed로 떨어지면 스켈레톤이 영원히 남는다.
    // 스트림 throw(SSE error 이벤트) — data가 없다. seed가 있으면 seed가 이기고,
    // 없으면 'error'를 노출해 스켈레톤이 영원히 남는 걸 막는다.
    it('스트림이 throw해도 peekSeed가 있으면 seed를 계속 보여 준다', async () => {
        mockSubmit.mockRejectedValue(new Error('분석 시간이 초과되었습니다.'));
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
        expect(result.current.input).toMatchObject({ status: 'cached' });
    });

    it('스트림이 throw하고 seed도 없으면 input="error"', async () => {
        mockSubmit.mockRejectedValue(new Error('분석 시간이 초과되었습니다.'));
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.input).toBe('error'));
    });
});
