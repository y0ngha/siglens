'use client';

import type { StreamErrorMessages } from '@/shared/hooks/useAnalysisStream';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useCallback, useMemo } from 'react';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import { useQuery } from '@tanstack/react-query';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import type { RunFundamentalAnalysisActionResult } from '@/entities/analysis/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';

export type FundamentalAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FundamentalAnalysisResponse;
          trigger: () => void;
      }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchFundamentalAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    messages: StreamErrorMessages,
    signal?: AbortSignal
): Promise<FundamentalAnalysisResponse> {
    const result = await runAnalysisStream<RunFundamentalAnalysisActionResult>({
        type: 'fundamental',
        params: { symbol, modelId, reasoning },
        signal,
        messages,
    });

    if (result.status === 'cached' || result.status === 'done')
        return result.result;
    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (result.status === 'error') {
        if (isGateBlockedResult(result)) {
            throw new Error(result.error.message);
        }
        const message =
            result.code === 'fetch_failed'
                ? (result.error ?? messages.fetchFailed)
                : messages.limitExceeded;
        throw new Error(message);
    }
    if (result.status === 'key_error') {
        throw new Error(messages.keyRequired);
    }
    throw new Error(messages.unexpected);
}

export function useFundamentalAnalysis(
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
     * `useAnalysisSettingsHydrated()`로 넘긴다. tier가 서버에서 확정되기 전에
     * 제출하면 DEFAULT 모델로 LLM을 한 번 태운 뒤 확정값으로 다시 태우게 된다.
     * 기본값 `true`는 게이트가 필요 없는 단위 테스트용이다.
     */
    isSettingsHydrated = true
): FundamentalAnalysisState {
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    const queryKey = useMemo(
        () =>
            QUERY_KEYS.fundamentalAnalysis(symbol, modelId, reasoning, locale),
        [symbol, modelId, reasoning, locale]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchFundamentalAnalysis(
                qSymbol,
                qModelId,
                qReasoning,
                streamMessages,
                signal
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

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below — derived values that are
    // consumed by subsequent hook calls must precede those hooks. The
    // `refetch` reference is stable across renders (React Query guarantee).
    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked', trigger: retry };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('분석 중 오류가 발생했습니다.'),
            retry,
            trigger: retry,
        };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data, trigger: retry };
    }

    return { status: 'loading', trigger: retry };
}
