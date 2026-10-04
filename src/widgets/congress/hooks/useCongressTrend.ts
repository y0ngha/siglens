'use client';

import { useTranslations } from 'next-intl';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useQuery } from '@tanstack/react-query';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import type { CongressTrendResponse, ModelId } from '@y0ngha/siglens-core';
import type { RunCongressTrendActionResult } from '@/entities/analysis/actions/runCongressTrendAction';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis/lib/gate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { readPlain, type WithPlain } from '@/shared/lib/plainEnvelope';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import { useRefetchWhenAllowed } from '@/shared/hooks/useRefetchWhenAllowed';

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
    | {
          status: 'done';
          result: CongressTrendResponse;
          /** 평이화 산문. `null`이면 쉽게보기 토글을 렌더하지 않는다. */
          plain: string | null;
          trigger: () => void;
      }
    | { status: 'no_trades'; trigger: () => void }
    | { status: 'awaiting_interaction'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchCongressTrend(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    messages: StreamErrorMessages,
    signal?: AbortSignal,
    cacheOnly = false
): Promise<WithPlain<CongressTrendResponse>> {
    const result = await runAnalysisStream<RunCongressTrendActionResult>({
        type: 'congress',
        params: {
            symbol,
            modelId,
            reasoning,
            ...(cacheOnly ? { cacheOnly: true } : {}),
        },
        signal,
        messages,
    });

    if (result.status === 'cached' || result.status === 'done')
        return { data: result.result, plain: readPlain(result) };
    // `miss_no_trigger`: AI 자동 실행 게이트가 막은 상태의 캐시 전용 조회가 미스였다
    // (`useAiAutoRunAllowed`). 오류가 아니라 대기 상태다 — 입력이 들어오면 다시 부른다.
    if (result.status === 'miss_no_trigger') {
        throw new AwaitingInteractionError();
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
        // core가 채우는 `result.error`는 영어 예외 문자열이다(위 훅들과 동일).
        if (result.error) console.error('[congressFetchFailed]', result.error);
        throw new Error(messages.congressFetchFailed);
    }
    throw new Error(messages.unexpected);
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
    isSettingsHydrated = true,
    /**
     * AI 분석을 생성까지 요청해도 되는지(`useAiAutoRunAllowed().allowed`). `false`면
     * 캐시만 조회하고, 미스면 `awaiting_interaction`으로 둔다. 기본값 `true`는 단위
     * 테스트와 게이트가 필요 없는 호출부용이다.
     */
    autoRunAllowed = true
): CongressTrendState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    // queryKey는 인라인으로 둔다(§17 훅 순서). React Query는 queryKey를
    // deep-equality로 비교하므로 매 렌더 새 배열 참조가 생성돼도 불필요한
    // 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.congressTrend(symbol, modelId, reasoning, locale),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchCongressTrend(
                qSymbol,
                qModelId,
                qReasoning,
                streamMessages,
                signal,
                !autoRunAllowed
            ),
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

    const isAwaitingInteraction =
        query.error instanceof AwaitingInteractionError;
    useRefetchWhenAllowed(autoRunAllowed, isAwaitingInteraction, refetch);

    if (query.isError) {
        if (isAwaitingInteraction) {
            // 게이트가 열려 다시 부르는 동안에는 React Query가 직전 오류를 유지한다 —
            // 그대로 두면 생성이 도는 내내 "AI 분석 보기" 버튼이 남는다.
            return query.isFetching
                ? { status: 'loading', trigger: retry }
                : { status: 'awaiting_interaction', trigger: retry };
        }
        if (query.error instanceof NoCongressTradesError) {
            return { status: 'no_trades', trigger: retry };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error(tError('trendFailed')),
            retry,
            trigger: retry,
        };
    }

    if (query.data !== undefined) {
        return {
            status: 'done',
            result: query.data.data,
            plain: query.data.plain,
            trigger: retry,
        };
    }

    return { status: 'loading', trigger: retry };
}
