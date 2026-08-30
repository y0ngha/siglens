'use client';

import { useTranslations } from 'next-intl';
import type { StreamErrorMessages } from '@/shared/hooks/useAnalysisStream';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useQuery } from '@tanstack/react-query';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import type { FinancialsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { RunFinancialsAnalysisActionResult } from '@/entities/analysis/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';
import { readPlain, type WithPlain } from '@/shared/lib/plainEnvelope';

export type FinancialsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FinancialsAnalysisResponse;
          /** 평이화 산문. `null`이면 쉽게보기 토글을 렌더하지 않는다. */
          plain: string | null;
          trigger: () => void;
      }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    messages: StreamErrorMessages,
    signal?: AbortSignal
): Promise<WithPlain<FinancialsAnalysisResponse>> {
    const result = await runAnalysisStream<RunFinancialsAnalysisActionResult>({
        type: 'financials',
        params: { symbol, modelId, reasoning },
        signal,
        messages,
    });

    if (result.status === 'cached' || result.status === 'done')
        return { data: result.result, plain: readPlain(result) };
    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (result.status === 'error') {
        if (isGateBlockedResult(result)) {
            throw new Error(result.error.message);
        }
        /**
         * core는 `fetch_failed`에 **항상** `error`를 채운다 — `String(error)`나
         * `Profile not found for symbol: AAPL` 같은 **영어 예외 문자열**이다
         * (core의 `dist/application` 아래 run 파일들). 그래서
         * `result.error ?? fallback`은
         * 폴백이 절대 안 걸리고 원시 예외가 전 로케일에 그대로 나갔다.
         * 카탈로그 문구를 먼저 쓰고, 원문은 개발자용으로 콘솔에만 남긴다.
         */
        if (result.code === 'fetch_failed' && result.error) {
            console.error('[fetchFailed]', result.error);
        }
        const message =
            result.code === 'fetch_failed'
                ? messages.fetchFailed
                : messages.limitExceeded;
        throw new Error(message);
    }
    if (result.status === 'key_error') {
        throw new Error(messages.keyRequired);
    }
    throw new Error(messages.unexpected);
}

export function useFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false` — pre-toggle callers keep resolving
     * to the exact same query key as before. Part of the query key so
     * toggling re-submits analysis (distinct cache key).
     */
    reasoning = false,
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated = true
): FinancialsAnalysisState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    // queryKey는 인라인으로 둔다(§17 훅 순서: useMemo는 useQuery보다 뒤여야 함).
    // React Query는 queryKey를 deep-equality로 비교하므로 매 렌더 새 배열 참조가
    // 생성돼도 불필요한 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.financialsAnalysis(
            symbol,
            modelId,
            reasoning,
            locale
        ),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchFinancialsAnalysis(
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

    const { refetch } = query;

    const retry = () => {
        void refetch();
    };

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked', trigger: retry };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error(tError('analysisFailed')),
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
