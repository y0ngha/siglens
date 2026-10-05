import { renderHook } from '@testing-library/react';
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRefetchStaleOnEnable } from '@/shared/hooks/useRefetchStaleOnEnable';

const KEY = ['refetch-test'] as const;
const clients: QueryClient[] = [];

/**
 * 실사용과 같은 구성이다 — 호출부는 `enabled`가 false인 동안 `staleTime`을 `Infinity`로 둔 쿼리
 * (`useBars`·`useFearGreedFromSymbol`)와 이 훅을 함께 쓴다. `stale` 필터는 observer의 판정을 쓰므로
 * observer 없는 쿼리로는 재현되지 않는다.
 */
function setup(options: { updatedAt: number; staleTimeWhenEnabled: number }) {
    const queryFn = vi.fn(async () => 'fetched');
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    clients.push(client);
    client.setQueryData(KEY, 'seed', { updatedAt: options.updatedAt });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const useGatedQuery = ({ enabled }: { enabled: boolean }) => {
        useQuery({
            queryKey: KEY,
            queryFn,
            staleTime: enabled ? options.staleTimeWhenEnabled : Infinity,
        });
        useRefetchStaleOnEnable(KEY, enabled);
    };
    return { queryFn, wrapper, useGatedQuery };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('useRefetchStaleOnEnable', () => {
    afterEach(() => {
        clients.splice(0).forEach(c => c.clear());
    });

    it('false → true 전환에서 stale 쿼리를 정확히 한 번 재조회한다', async () => {
        const { queryFn, wrapper, useGatedQuery } = setup({
            updatedAt: 1_000,
            staleTimeWhenEnabled: 0,
        });
        const { rerender } = renderHook(useGatedQuery, {
            wrapper,
            initialProps: { enabled: false },
        });
        await settle();
        // staleTime이 Infinity인 동안은 오래된 seed여도 마운트 재조회가 없다.
        expect(queryFn).not.toHaveBeenCalled();

        rerender({ enabled: true });
        await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

        // 이후 렌더에서 추가 요청은 없다.
        rerender({ enabled: true });
        await settle();
        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('처음부터 true면 훅은 재조회를 더하지 않는다 (RQ 마운트 재조회 한 번뿐)', async () => {
        const { queryFn, wrapper, useGatedQuery } = setup({
            updatedAt: 1_000,
            staleTimeWhenEnabled: 0,
        });
        renderHook(useGatedQuery, {
            wrapper,
            initialProps: { enabled: true },
        });
        await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
        await settle();
        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('stale이 아닌(방금 받은) 쿼리는 전환해도 재조회하지 않는다', async () => {
        const { queryFn, wrapper, useGatedQuery } = setup({
            updatedAt: Date.now(),
            staleTimeWhenEnabled: 60_000,
        });
        const { rerender } = renderHook(useGatedQuery, {
            wrapper,
            initialProps: { enabled: false },
        });
        rerender({ enabled: true });
        await settle();
        expect(queryFn).not.toHaveBeenCalled();
    });

    it('true → false에서는 재조회하지 않고, 다시 true가 되면 stale인 경우 한 번 더 조회한다', async () => {
        const { queryFn, wrapper, useGatedQuery } = setup({
            updatedAt: 1_000,
            staleTimeWhenEnabled: 0,
        });
        const { rerender } = renderHook(useGatedQuery, {
            wrapper,
            initialProps: { enabled: false },
        });
        rerender({ enabled: true });
        await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

        rerender({ enabled: false });
        await settle();
        expect(queryFn).toHaveBeenCalledTimes(1);

        // 첫 재조회로 받은 값도 staleTime 0이라 다시 stale이다 — 설계상 "전환마다, stale이면 한 번".
        rerender({ enabled: true });
        await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });
});
