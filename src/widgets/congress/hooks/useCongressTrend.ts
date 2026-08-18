'use client';

import { useQuery } from '@tanstack/react-query';
import type { CongressTrendResponse, ModelId } from '@y0ngha/siglens-core';
import type { RunCongressTrendActionResult } from '@/entities/analysis/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';

/**
 * Sentinel exception used to carry the `no_trades` outcome from the React
 * Query `queryFn` (which can only resolve to data or throw) into the hook's
 * state machine — there it is mapped to `{ status: 'no_trades' }`.
 *
 * Congress 0건 is NOT an error: many symbols simply have no disclosures, so
 * we deliberately do not enqueue an LLM job. Surfacing as a typed throw lets
 * React Query treat the query as "settled, no data" without polluting the
 * cache with a fake response object.
 */
class NoCongressTradesError extends Error {
    constructor() {
        super('no_trades');
        this.name = 'NoCongressTradesError';
    }
}

export type CongressTrendState =
    | { status: 'loading'; trigger: () => void }
    | { status: 'done'; result: CongressTrendResponse; trigger: () => void }
    | { status: 'no_trades'; trigger: () => void }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchCongressTrend(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    signal?: AbortSignal
): Promise<CongressTrendResponse> {
    const result = await runAnalysisStream<RunCongressTrendActionResult>({
        type: 'congress',
        params: { symbol, modelId, reasoning },
        signal,
    });

    if (result.status === 'cached' || result.status === 'done')
        return result.result;
    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (result.status === 'no_trades') {
        throw new NoCongressTradesError();
    }
    if (result.status === 'error') {
        // BYOK/tier 게이트 차단(AnalysisGateBlockedResult) vs. core의
        // fetch_failed(문자열 error) — 두 `status: 'error'` 변형을 구분해야 한다.
        if (isGateBlockedResult(result)) {
            throw new Error(result.error.message);
        }
        throw new Error(
            result.error ?? '의회 거래 데이터를 불러오지 못했습니다.'
        );
    }
    throw new Error('예상치 못한 오류가 발생했습니다.');
}

export function useCongressTrend(
    symbol: string,
    modelId: ModelId,
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false`. Part of the query key so toggling
     * re-submits analysis (distinct cache key).
     */
    reasoning = false,
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated = true
): CongressTrendState {
    // queryKey는 인라인으로 둔다(§17 훅 순서). React Query는 queryKey를
    // deep-equality로 비교하므로 매 렌더 새 배열 참조가 생성돼도 불필요한
    // 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.congressTrend(symbol, modelId, reasoning),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchCongressTrend(qSymbol, qModelId, qReasoning, signal),
        // 캐시가 없을 때만 1회 자동 실행한다. staleTime: Infinity라 캐시가 있으면
        // 조용히 재사용되고(재요청 없음), 포커스/재연결 재요청은 꺼서 실패 이후
        // 창 포커스만으로 AI 분석이 다시 도는 것을 막는다. 수동 재시도는 retry().
        enabled: isSettingsHydrated,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const retry = () => {
        void refetch();
    };

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked', trigger: retry };
        }
        if (query.error instanceof NoCongressTradesError) {
            return { status: 'no_trades', trigger: retry };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('동향 해석 중 오류가 발생했습니다.'),
            retry,
            trigger: retry,
        };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data, trigger: retry };
    }

    return { status: 'loading', trigger: retry };
}
