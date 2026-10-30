'use client';

import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    QUERY_KEYS,
    WATCHLIST_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { addWatchlistItemAction } from '../actions/addWatchlistItemAction';
import { getWatchlistAction } from '../actions/getWatchlistAction';
import { removeWatchlistItemAction } from '../actions/removeWatchlistItemAction';
import { normalizeWatchlistLabel } from '../lib/normalizeWatchlistLabel';
import {
    rollbackAddedItem,
    rollbackRemovedItem,
} from '../lib/watchlistListOps';
import type {
    AddWatchlistResult,
    RawWatchlistInput,
    RemoveWatchlistResult,
    WatchlistItemView,
    WatchlistMutationContext,
} from '../model';

interface UseWatchlistQueryOptions {
    /** 회원 추정일 때만 켠다. 꺼져 있어도 같은 키의 캐시는 읽지 않고 빈 목록을 돌려준다. */
    enabled: boolean;
}

/** `useWatchlistQuery`의 반환. 소비처는 `features/watchlist`의 훅들. */
export interface UseWatchlistQueryResult {
    items: WatchlistItemView[];
    /** 아직 모름(`enabled`인데 첫 응답 전). RQ-3: `data === undefined`가 아니라 `isPending`으로 판단. */
    isPending: boolean;
    isError: boolean;
    add: UseMutationResult<
        AddWatchlistResult,
        Error,
        RawWatchlistInput,
        WatchlistMutationContext
    >;
    remove: UseMutationResult<
        RemoveWatchlistResult,
        Error,
        string,
        WatchlistMutationContext
    >;
}

/** 두 변이가 공유하는 키 — 진행 중인 변이 수로 재동기화 시점을 정한다. */
const MUTATION_KEY = ['watchlist', 'mutate'] as const;

/** 참조가 안정적인 빈 목록 — 비활성·미로딩 때 새 배열을 만들지 않는다. */
const EMPTY: WatchlistItemView[] = [];

/**
 * 회원 관심종목 쿼리와 낙관적 담기·빼기. 낙관적 갱신은 두 실패 경로를 모두 되돌린다 —
 * 액션이 **던진** 경우(`onError`)와 액션이 `{ status: 'error' }`를 **돌려준** 경우(`onSuccess`,
 * 서버 액션은 던지지 않는 계약이라 이 경로가 더 흔하다). 어느 쪽이든 `onSettled`가 서버
 * 목록으로 다시 맞춘다.
 */
export function useWatchlistQuery({
    enabled,
}: UseWatchlistQueryOptions): UseWatchlistQueryResult {
    const qc = useQueryClient();
    const key = QUERY_KEYS.watchlist();

    const query = useQuery({
        queryKey: key,
        queryFn: () => getWatchlistAction(),
        enabled,
        staleTime: WATCHLIST_STALE_TIME_MS,
    });

    const capture = async (
        symbol: string
    ): Promise<WatchlistMutationContext> => {
        await qc.cancelQueries({ queryKey: key });
        const current = qc.getQueryData<WatchlistItemView[]>(key) ?? EMPTY;
        const index = current.findIndex(item => item.symbol === symbol);
        return { symbol, prior: current[index] ?? null, index };
    };
    const update = (
        fn: (current: WatchlistItemView[]) => WatchlistItemView[]
    ): void => {
        qc.setQueryData<WatchlistItemView[]>(key, current =>
            fn(current ?? EMPTY)
        );
    };
    const rollbackAdd = (
        context: WatchlistMutationContext | undefined
    ): void => {
        if (!context) return;
        update(current => rollbackAddedItem(current, context));
    };
    const rollbackRemove = (
        context: WatchlistMutationContext | undefined
    ): void => {
        if (!context) return;
        update(current => rollbackRemovedItem(current, context));
    };
    /**
     * 진행 중인 변이가 이 변이 하나뿐일 때만 서버 목록으로 다시 맞춘다. `onSettled`가 불리는
     * 시점에는 정산 중인 변이가 아직 pending으로 세어진다(TanStack v5는 `onSettled` 뒤에
     * 상태를 success/error로 바꾼다). 먼저 끝난 변이가 refetch하면 아직 진행 중인 다른
     * 낙관적 행이 서버 응답에 없어 깜빡이며 사라진다.
     */
    const resync = (): void => {
        if (qc.isMutating({ mutationKey: MUTATION_KEY }) > 1) return;
        void qc.invalidateQueries({ queryKey: key });
    };

    const add = useMutation<
        AddWatchlistResult,
        Error,
        RawWatchlistInput,
        WatchlistMutationContext
    >({
        mutationKey: MUTATION_KEY,
        mutationFn: input => addWatchlistItemAction(input),
        onMutate: async input => {
            const symbol = input.symbol.trim().toUpperCase();
            const context = await capture(symbol);
            const optimistic: WatchlistItemView = {
                symbol,
                companyName: normalizeWatchlistLabel(input.label, symbol),
                // 서버가 확정하기 전의 자리표시 시각. 목록은 addedAt 내림차순이라 맨 앞에 선다.
                addedAt: new Date().toISOString(),
            };
            update(current => [
                optimistic,
                ...current.filter(item => item.symbol !== symbol),
            ]);
            return context;
        },
        onError: (_error, _input, context) => rollbackAdd(context),
        onSuccess: (result, _input, context) => {
            if (result.status !== 'ok') rollbackAdd(context);
        },
        onSettled: resync,
    });

    const remove = useMutation<
        RemoveWatchlistResult,
        Error,
        string,
        WatchlistMutationContext
    >({
        mutationKey: MUTATION_KEY,
        mutationFn: symbol => removeWatchlistItemAction(symbol),
        onMutate: async symbol => {
            const upper = symbol.toUpperCase();
            const context = await capture(upper);
            update(current => current.filter(item => item.symbol !== upper));
            return context;
        },
        onError: (_error, _symbol, context) => rollbackRemove(context),
        onSuccess: (result, _symbol, context) => {
            if (result.status !== 'ok') rollbackRemove(context);
        },
        onSettled: resync,
    });

    return {
        items: enabled ? (query.data ?? EMPTY) : EMPTY,
        isPending: enabled && query.isPending,
        isError: query.isError,
        add,
        remove,
    };
}
