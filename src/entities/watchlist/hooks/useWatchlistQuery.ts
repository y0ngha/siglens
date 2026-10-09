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
import { addWatchlistItemAction } from '@/entities/watchlist/actions/addWatchlistItemAction';
import { getWatchlistAction } from '@/entities/watchlist/actions/getWatchlistAction';
import { removeWatchlistItemAction } from '@/entities/watchlist/actions/removeWatchlistItemAction';
import type {
    AddWatchlistResult,
    RawWatchlistInput,
    RemoveWatchlistResult,
    WatchlistItemView,
} from '../model';

interface UseWatchlistQueryOptions {
    /** 회원 추정일 때만 켠다. 꺼져 있어도 같은 키의 캐시는 읽지 않고 빈 목록을 돌려준다. */
    enabled: boolean;
}

export interface UseWatchlistQueryResult {
    items: WatchlistItemView[];
    /** 아직 모름(`enabled`인데 첫 응답 전). RQ-3: `data === undefined`가 아니라 `isPending`으로 판단. */
    isPending: boolean;
    isError: boolean;
    add: UseMutationResult<
        AddWatchlistResult,
        Error,
        RawWatchlistInput,
        MutationContext
    >;
    remove: UseMutationResult<
        RemoveWatchlistResult,
        Error,
        string,
        MutationContext
    >;
}

/**
 * 변이 시작 시점에 그 심볼에 대해 알던 것. 목록 전체 스냅샷이 아니라 **심볼 단위**로 되돌려야
 * 동시에 진행 중인 다른 심볼의 낙관적 행을 지우지 않는다.
 */
interface MutationContext {
    symbol: string;
    /** 변이 직전 캐시에 있던 그 심볼의 행(없으면 null). */
    prior: WatchlistItemView | null;
    /** `prior`가 있던 자리. */
    index: number;
}

/** 두 변이가 공유하는 키 — 진행 중인 변이 수로 재동기화 시점을 정한다. */
const MUTATION_KEY = ['watchlist', 'mutate'] as const;

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

    const capture = async (symbol: string): Promise<MutationContext> => {
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
    const insertAt = (
        list: WatchlistItemView[],
        item: WatchlistItemView,
        index: number
    ): WatchlistItemView[] => {
        const next = [...list];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
    };
    /** 담기 실패: 그 심볼만 변이 전 상태(없었으면 없음)로 돌린다. */
    const rollbackAdd = (context: MutationContext | undefined): void => {
        if (!context) return;
        update(current => {
            const without = current.filter(
                item => item.symbol !== context.symbol
            );
            return context.prior
                ? insertAt(without, context.prior, context.index)
                : without;
        });
    };
    /** 빼기 실패: 지운 행만 원래 자리에 다시 넣는다(이미 돌아와 있으면 그대로). */
    const rollbackRemove = (context: MutationContext | undefined): void => {
        if (!context?.prior) return;
        const { prior, index, symbol } = context;
        update(current =>
            current.some(item => item.symbol === symbol)
                ? current
                : insertAt(current, prior, index)
        );
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
        MutationContext
    >({
        mutationKey: MUTATION_KEY,
        mutationFn: input => addWatchlistItemAction(input),
        onMutate: async input => {
            const symbol = input.symbol.trim().toUpperCase();
            const context = await capture(symbol);
            const optimistic: WatchlistItemView = {
                symbol,
                companyName:
                    input.label.trim() &&
                    input.label.trim().toUpperCase() !== symbol
                        ? input.label.trim()
                        : null,
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
        MutationContext
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
