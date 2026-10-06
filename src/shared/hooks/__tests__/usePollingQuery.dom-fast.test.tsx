import { act, renderHook } from '@testing-library/react';
import {
    focusManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
    type OnPollSettled,
    usePollingQuery,
} from '@/shared/hooks/usePollingQuery';

const INTERVAL_MS = 3_000;
const KEY = ['poll-test'] as const;

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }
    return { client, Wrapper };
}

async function advance(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('usePollingQuery', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        focusManager.setFocused(true);
    });

    afterEach(() => {
        vi.useRealTimers();
        focusManager.setFocused(undefined);
    });

    it('마운트 때 한 번, 그 뒤 간격마다 조회하고 결과마다 onSettled를 한 번 부른다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const onSettled = vi.fn<OnPollSettled<string[]>>(() => 'continue');
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled,
                }),
            { wrapper: Wrapper }
        );
        await advance(0);
        await advance(INTERVAL_MS);
        await advance(INTERVAL_MS);

        expect(queryFn).toHaveBeenCalledTimes(3);
        expect(onSettled).toHaveBeenCalledTimes(3);
        expect(onSettled).toHaveBeenLastCalledWith(
            { ok: true, data: ['a'] },
            expect.any(Number)
        );
    });

    it("'stop'을 돌려주면 더 조회하지 않는다", async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: () => 'stop',
                }),
            { wrapper: Wrapper }
        );
        await advance(0);
        await advance(INTERVAL_MS * 3);

        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('실패도 결과로 넘긴다', async () => {
        const queryFn = vi.fn().mockRejectedValue(new Error('boom'));
        const onSettled = vi.fn<OnPollSettled<string[]>>(() => 'stop');
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled,
                }),
            { wrapper: Wrapper }
        );
        await advance(0);

        expect(onSettled).toHaveBeenCalledWith(
            { ok: false, error: expect.objectContaining({ message: 'boom' }) },
            expect.any(Number)
        );
    });

    it('같은 키를 쓰는 두 폴러는 틱마다 요청 하나를 나눠 쓰고 둘 다 결과를 판정한다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const first = vi.fn<OnPollSettled<string[]>>(() => 'continue');
        const second = vi.fn<OnPollSettled<string[]>>(() => 'continue');
        const { Wrapper } = makeWrapper();

        renderHook(
            () => {
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: first,
                });
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: second,
                });
            },
            { wrapper: Wrapper }
        );
        await advance(0);
        await advance(INTERVAL_MS);
        await advance(INTERVAL_MS);

        expect(queryFn).toHaveBeenCalledTimes(3);
        expect(first).toHaveBeenCalledTimes(3);
        expect(second).toHaveBeenCalledTimes(3);
    });

    it('응답이 이전과 같으면 호출부를 다시 그리지 않는다(구조적 공유)', async () => {
        const queryFn = vi.fn().mockImplementation(async () => [{ id: 1 }]);
        const { Wrapper } = makeWrapper();
        let renders = 0;

        renderHook(
            () => {
                renders += 1;
                return usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: () => 'continue',
                });
            },
            { wrapper: Wrapper }
        );
        await advance(0);
        const rendersAfterFirstData = renders;
        await advance(INTERVAL_MS * 3);

        expect(queryFn).toHaveBeenCalledTimes(4);
        expect(renders).toBe(rendersAfterFirstData);
    });

    it('탭이 숨겨진 동안에는 조회하지 않는다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: () => 'continue',
                }),
            { wrapper: Wrapper }
        );
        await advance(0);
        act(() => {
            focusManager.setFocused(false);
        });
        await advance(INTERVAL_MS * 3);

        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('언마운트하면 더 조회하지 않는다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const { Wrapper } = makeWrapper();

        const { unmount } = renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: () => 'continue',
                }),
            { wrapper: Wrapper }
        );
        await advance(0);
        unmount();
        await advance(INTERVAL_MS * 3);

        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('enabled=false면 조회도 판정도 하지 않는다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const onSettled = vi.fn<OnPollSettled<string[]>>(() => 'continue');
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: false,
                    onSettled,
                }),
            { wrapper: Wrapper }
        );
        await advance(INTERVAL_MS * 3);

        expect(queryFn).not.toHaveBeenCalled();
        expect(onSettled).not.toHaveBeenCalled();
    });

    it('elapsedMs는 폴링을 시작한 뒤 흐른 시간이다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['a']);
        const onSettled = vi.fn<OnPollSettled<string[]>>(() => 'continue');
        const { Wrapper } = makeWrapper();

        renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled,
                }),
            { wrapper: Wrapper }
        );
        await advance(0);
        await advance(INTERVAL_MS * 2);

        const elapsed = onSettled.mock.calls.at(-1)?.[1] ?? 0;
        expect(elapsed).toBeGreaterThanOrEqual(INTERVAL_MS * 2);
    });

    it('이전 마운트의 캐시가 이번 서버 스냅샷(initialData)을 덮지 않는다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['old-fetch']);
        const { Wrapper } = makeWrapper();
        const options = (snapshot: string[]) => ({
            queryKey: KEY,
            queryFn,
            intervalMs: INTERVAL_MS,
            enabled: true,
            onSettled: () => 'stop' as const,
            initialData: snapshot,
        });

        const first = renderHook(() => usePollingQuery(options(['a'])), {
            wrapper: Wrapper,
        });
        await advance(0);
        expect(first.result.current).toEqual(['old-fetch']);
        first.unmount();
        await advance(0);

        // 같은 QueryClient로 다시 마운트 — 새 스냅샷이 먼저 보여야 한다.
        queryFn.mockImplementation(() => new Promise<string[]>(() => {}));
        const second = renderHook(() => usePollingQuery(options(['fresh'])), {
            wrapper: Wrapper,
        });

        expect(second.result.current).toEqual(['fresh']);
    });

    it('initialData는 곧바로 낡은 값이라 마운트 때 다시 조회한다', async () => {
        const queryFn = vi.fn().mockResolvedValue(['fetched']);
        const { Wrapper } = makeWrapper();

        const { result } = renderHook(
            () =>
                usePollingQuery({
                    queryKey: KEY,
                    queryFn,
                    intervalMs: INTERVAL_MS,
                    enabled: true,
                    onSettled: () => 'stop',
                    initialData: ['snapshot'],
                }),
            { wrapper: Wrapper }
        );
        expect(result.current).toEqual(['snapshot']);
        await advance(0);

        expect(queryFn).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual(['fetched']);
    });
});
