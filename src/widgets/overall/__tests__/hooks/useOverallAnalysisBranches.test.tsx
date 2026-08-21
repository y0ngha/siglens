/**
 * Branch coverage tests for useOverallAnalysis — targets uncovered branches:
 * miss_no_trigger (bot blocked), key_error, gate blocked error,
 * non-string error in submit, hydration gate, submitting state.
 *
 * Poll/cancel/pending_dependencies machinery has been removed; run* functions
 * return results directly.
 */

import koMessages from '../../../../../messages/ko.json';
import type { Mock } from 'vitest';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));
vi.mock('@/entities/analysis', () => ({
    isGateBlockedResult: vi.fn().mockReturnValue(false),
}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;
const mockIsGateBlocked = isGateBlockedResult as unknown as Mock;

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

function hookArgs() {
    return ['AAPL', 'Apple Inc.', '1Day', 'gemini-2.5-flash-lite'] as const;
}

describe('useOverallAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('SSR seed는 마운트 key에만 적용된다 — tier 확정으로 modelId가 바뀌면 회원 모델로 새로 분석한다', async () => {
        // 회귀 가드: React Query는 `initialData`를 활성 queryKey에 다시 적용한다.
        // 가드가 없으면 DEFAULT 모델로 만든 SSR seed가 회원 모델 key까지 채우고
        // staleTime: Infinity가 그걸 fresh로 취급해 fetch가 영영 일어나지 않는다.
        const SEED = { headlineKo: 'SSR seed' } as never;
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: { headlineKo: '회원 모델 분석' },
        });

        const wrapper = makeWrapper();
        const { result, rerender } = renderHook(
            ({
                modelId,
                settingsHydrated,
            }: {
                modelId: string;
                settingsHydrated: boolean;
            }) =>
                useOverallAnalysis(
                    'AAPL',
                    'Apple Inc.',
                    '1Day',
                    modelId as never,
                    SEED,
                    'equity',
                    false,
                    settingsHydrated
                ),
            {
                wrapper,
                // tier 미확정: DEFAULT 모델 + 게이트 닫힘
                initialProps: {
                    modelId: 'deepseek-v4-flash',
                    settingsHydrated: false,
                },
            }
        );

        // seed 덕분에 마운트 즉시 done, 생성은 트리거되지 않는다.
        expect(result.current.state.status).toBe('done');
        expect(mockSubmit).not.toHaveBeenCalled();

        // tier 확정 — modelId가 회원의 저장 모델로 넓어지고 게이트가 열린다.
        rerender({ modelId: 'claude-sonnet-5', settingsHydrated: true });

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
        expect(mockSubmit.mock.calls[0]?.[0]?.params?.modelId).toBe(
            'claude-sonnet-5'
        );
        await waitFor(() => {
            if (result.current.state.status !== 'done')
                throw new Error('expected done');
            expect(result.current.state.result.headlineKo).toBe(
                '회원 모델 분석'
            );
        });
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({
            status: 'miss_no_trigger',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('bot_blocked');
        });
    });

    it('does not submit while the settings-hydration gate is closed even after trigger', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: {
                headlineKo: 'test',
                technicalBulletsKo: [],
                fundamentalBulletsKo: [],
                newsBulletsKo: [],
                optionsBulletsKo: [],
                financialsBulletsKo: [],
                integratedConclusionKo: '중립',
                scenarios: [],
                riskFactorsKo: [],
            } as never,
        });

        const { result } = renderHook(
            () =>
                useOverallAnalysis(
                    ...hookArgs(),
                    undefined,
                    'equity',
                    false,
                    false
                ),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.trigger();
        });

        // Flush any (incorrectly) queued async work — if the gate leaked, the
        // trigger would have caused submit to fire within this tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.state.status).toBe('submitting');
    });

    it('returns error for gate-blocked result', async () => {
        mockIsGateBlocked.mockReturnValue(true);
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_exceeded', message: '등급 제한 초과' },
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toBe('등급 제한 초과');
    });

    it('returns error for non-string error in submit', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: 12345,
            axis: 'fundamental',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toContain('오류가 발생했습니다');
    });

    it('returns error for key_error', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key invalid',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toBe(koMessages.app.api.stream.keyRequired);
    });

    it('returns submitting status immediately after trigger', async () => {
        mockSubmit.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        // Should be submitting since we're waiting
        expect(result.current.state.status).toBe('submitting');
    });
});
