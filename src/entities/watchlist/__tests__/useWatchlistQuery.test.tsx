vi.mock('@/entities/watchlist/actions/getWatchlistAction', () => ({
    getWatchlistAction: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/addWatchlistItemAction', () => ({
    addWatchlistItemAction: vi.fn(),
}));
vi.mock('@/entities/watchlist/actions/removeWatchlistItemAction', () => ({
    removeWatchlistItemAction: vi.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { getWatchlistAction } from '@/entities/watchlist/actions/getWatchlistAction';
import { addWatchlistItemAction } from '@/entities/watchlist/actions/addWatchlistItemAction';
import { removeWatchlistItemAction } from '@/entities/watchlist/actions/removeWatchlistItemAction';
import { useWatchlistQuery } from '@/entities/watchlist/hooks/useWatchlistQuery';
import type { WatchlistItemView } from '@/entities/watchlist/model';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockGet = vi.mocked(getWatchlistAction);
const mockAdd = vi.mocked(addWatchlistItemAction);
const mockRemove = vi.mocked(removeWatchlistItemAction);

const AAPL: WatchlistItemView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    addedAt: '2026-10-01T00:00:00.000Z',
};

/** 호출부가 resolve 시점을 쥔 promise — 낙관적 상태를 "확정 전"에 관찰하기 위해서다. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('useWatchlistQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue([AAPL]);
    });

    it('enabled=false면 조회하지 않고 items는 빈 배열이다', () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: false }),
            { wrapper }
        );
        expect(result.current.items).toEqual([]);
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('enabled=true면 목록을 받아 items에 둔다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toEqual([AAPL]));
    });

    it('add는 확정 전에 낙관적으로 목록 맨 앞에 넣고, 성공 후 목록을 다시 받는다', async () => {
        const { wrapper, client } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        const pending =
            deferred<Awaited<ReturnType<typeof addWatchlistItemAction>>>();
        mockAdd.mockReturnValue(pending.promise);
        act(() => {
            void result.current.add.mutateAsync({
                symbol: 'MSFT',
                label: '마이크로소프트',
            });
        });
        await waitFor(() =>
            expect(result.current.items.map(i => i.symbol)).toEqual([
                'MSFT',
                'AAPL',
            ])
        );
        expect(result.current.items[0]?.companyName).toBe('마이크로소프트');

        const MSFT: WatchlistItemView = {
            symbol: 'MSFT',
            companyName: 'Microsoft Corp.',
            addedAt: '2026-10-09T00:00:00.000Z',
        };
        mockGet.mockResolvedValue([MSFT, AAPL]);
        await act(async () => {
            pending.resolve({ status: 'ok', item: MSFT });
        });
        await waitFor(() =>
            expect(client.getQueryData(QUERY_KEYS.watchlist())).toEqual([
                MSFT,
                AAPL,
            ])
        );
    });

    it('낙관적 행의 표시명도 서버와 같은 규칙(공백 제거·100자 절단·심볼과 같으면 null)을 쓴다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));
        mockAdd.mockReturnValue(new Promise(() => {}));

        act(() => {
            void result.current.add.mutateAsync({
                symbol: 'msft',
                label: `  ${'x'.repeat(150)} `,
            });
        });
        await waitFor(() => expect(result.current.items).toHaveLength(2));
        expect(result.current.items[0]?.companyName).toBe('x'.repeat(100));

        act(() => {
            void result.current.add.mutateAsync({
                symbol: 'NVDA',
                label: 'nvda',
            });
        });
        await waitFor(() => expect(result.current.items).toHaveLength(3));
        expect(result.current.items[0]?.companyName).toBeNull();
    });

    it('add가 던지면 이전 목록으로 되돌린다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        mockAdd.mockRejectedValue(new Error('network'));
        await act(async () => {
            await result.current.add
                .mutateAsync({ symbol: 'MSFT', label: 'MSFT' })
                .catch(() => undefined);
        });
        await waitFor(() =>
            expect(result.current.items.map(i => i.symbol)).toEqual(['AAPL'])
        );
    });

    it('add가 error 결과를 돌려주면(던지지 않음) 이전 목록으로 되돌린다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        mockAdd.mockResolvedValue({
            status: 'error',
            code: 'limit_reached',
            message: '상한',
        });
        await act(async () => {
            await result.current.add.mutateAsync({
                symbol: 'MSFT',
                label: 'MSFT',
            });
        });
        await waitFor(() =>
            expect(result.current.items.map(i => i.symbol)).toEqual(['AAPL'])
        );
    });

    it('remove는 낙관적으로 목록에서 빼고 실패하면 되돌린다', async () => {
        const { wrapper } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        const pending =
            deferred<Awaited<ReturnType<typeof removeWatchlistItemAction>>>();
        mockRemove.mockReturnValue(pending.promise);
        act(() => {
            void result.current.remove
                .mutateAsync('AAPL')
                .catch(() => undefined);
        });
        await waitFor(() => expect(result.current.items).toEqual([]));
        await act(async () => {
            pending.reject(new Error('db'));
        });
        await waitFor(() => expect(result.current.items).toEqual([AAPL]));
    });

    it('동시에 두 번 담을 때 하나가 실패해도 다른 하나의 낙관적 행은 사라지지 않는다', async () => {
        const { wrapper, client } = createQueryClientWrapper();
        const { result } = renderHook(
            () => useWatchlistQuery({ enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        const msft =
            deferred<Awaited<ReturnType<typeof addWatchlistItemAction>>>();
        const nvda =
            deferred<Awaited<ReturnType<typeof addWatchlistItemAction>>>();
        mockAdd.mockImplementation(({ symbol }) =>
            symbol === 'MSFT' ? msft.promise : nvda.promise
        );
        const symbolsSeen: string[][] = [];
        const unsubscribe = client.getQueryCache().subscribe(() => {
            const data = client.getQueryData<WatchlistItemView[]>(
                QUERY_KEYS.watchlist()
            );
            if (data) symbolsSeen.push(data.map(i => i.symbol));
        });

        act(() => {
            void result.current.add
                .mutateAsync({ symbol: 'MSFT', label: 'MSFT' })
                .catch(() => undefined);
        });
        await waitFor(() => expect(result.current.items).toHaveLength(2));
        act(() => {
            void result.current.add.mutateAsync({
                symbol: 'NVDA',
                label: 'NVDA',
            });
        });
        await waitFor(() => expect(result.current.items).toHaveLength(3));

        const NVDA: WatchlistItemView = {
            symbol: 'NVDA',
            companyName: 'NVIDIA',
            addedAt: '2026-10-09T00:00:00.000Z',
        };
        mockGet.mockResolvedValue([NVDA, AAPL]);
        const callsBefore = mockGet.mock.calls.length;
        symbolsSeen.length = 0;

        await act(async () => {
            msft.reject(new Error('network'));
        });
        // MSFT 정산 시점: NVDA는 아직 진행 중 — 행이 남아 있어야 하고 refetch도 아직이다.
        await waitFor(() =>
            expect(result.current.items.map(i => i.symbol)).toEqual([
                'NVDA',
                'AAPL',
            ])
        );
        expect(mockGet.mock.calls.length).toBe(callsBefore);

        await act(async () => {
            nvda.resolve({ status: 'ok', item: NVDA });
        });
        await waitFor(() =>
            expect(client.getQueryData(QUERY_KEYS.watchlist())).toEqual([
                NVDA,
                AAPL,
            ])
        );
        // 두 변이가 모두 끝난 뒤에만, 정확히 한 번 다시 받는다.
        expect(mockGet.mock.calls.length).toBe(callsBefore + 1);
        for (const snapshot of symbolsSeen) {
            expect(snapshot).toContain('NVDA');
        }
        unsubscribe();
    });
});
