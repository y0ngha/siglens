'use client';

/**
 * 재무 AI 분석 쿼리 훅 — SSE 스트림 호출, 게이트 대기(`awaiting_interaction`), 오류 정규화를
 * 한 곳에서 맡아 위젯이 상태 유니온만 보고 렌더하게 한다.
 */
import { useTranslations } from 'next-intl';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useQuery } from '@tanstack/react-query';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import type { FinancialsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { RunFinancialsAnalysisActionResult } from '@/entities/analysis/actions/runFinancialsAnalysisAction';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis/lib/gate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { readPlain, type WithPlain } from '@/shared/lib/plainEnvelope';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import { useRefetchWhenAllowed } from '@/shared/hooks/useRefetchWhenAllowed';

/** 위젯이 분기하는 분석 상태 유니온. 모든 variant가 `trigger`를 노출한다. */
export type FinancialsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FinancialsAnalysisResponse;
          /** 평이화 산문. `null`이면 쉽게보기 토글을 렌더하지 않는다. */
          plain: string | null;
          trigger: () => void;
      }
    | { status: 'awaiting_interaction'; trigger: () => void }
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
    signal?: AbortSignal,
    cacheOnly = false
): Promise<WithPlain<FinancialsAnalysisResponse>> {
    const result = await runAnalysisStream<RunFinancialsAnalysisActionResult>({
        type: 'financials',
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
    // `miss_no_trigger`: 실행 권한(`useAiRunPermission`)이 막은 상태의 캐시 전용 조회가
    // 미스였다. 오류가 아니라 대기 상태다 — 권한이 열리면 다시 부른다.
    if (result.status === 'miss_no_trigger') {
        throw new AwaitingInteractionError();
    }
    if (result.status === 'error') {
        if (isGateBlockedResult(result)) {
            throw new Error(result.error.message);
        }
        /**
         * core는 `fetch_failed`에 **항상** 영어 예외 문자열(`Profile not found for symbol: AAPL`
         * 등)을 `error`로 채운다 — `result.error ?? fallback`으로는 폴백이 걸리지 않고 원문이
         * 전 로케일에 나가므로, 화면에는 카탈로그 문구를 쓰고 원문은 개발자용으로 콘솔에만
         * 남긴다.
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

/**
 * 재무 분석을 조회하고 상태 유니온으로 돌려준다. `autoRunAllowed`가 거짓이면 캐시만 읽고,
 * 허용되는 순간 대기 중인 쿼리를 한 번 다시 불러 생성한다.
 *
 * 한 번 받은 결과는 재실행이 실패해도 지킨다 — 공유 트리거나 재시도가 완료된 분석을 다시
 * 돌렸다가 실패했을 때 보이던 결과를 오류 카드로 바꾸지 않는다.
 */
export function useFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    /**
     * 회원의 "깊은 생각" 토글 값. 기본값은 `false`이며 쿼리 키의 일부라 토글하면 별도 캐시
     * 키로 분석을 다시 제출한다.
     */
    reasoning = false,
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated = true,
    /**
     * AI 분석을 생성까지 요청해도 되는지(`useAiRunPermission().allowed`). `false`면 캐시만
     * 조회하고, 미스면 `awaiting_interaction`으로 둔다. 기본값 `true`는 단위 테스트와 게이트가
     * 필요 없는 호출부용이다.
     */
    autoRunAllowed = true
): FinancialsAnalysisState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    // queryKey는 메모하지 않는다 — React Query가 키를 깊은 비교하므로 매 렌더 새 배열이어도
    // 같은 쿼리다.
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

    // useRefetchWhenAllowed의 입력(isAwaiting)이 query.error에서 파생되므로 파생값 바로 뒤에
    // 선언한다(HK-1 예외) — 다른 훅은 모두 이 변수 앞에 있다.
    const isAwaitingInteraction =
        query.error instanceof AwaitingInteractionError;
    useRefetchWhenAllowed(autoRunAllowed, isAwaitingInteraction, refetch);

    // 데이터가 있으면 오류보다 먼저 본다 — React Query는 재실행이 실패해도 직전 데이터를 남긴다.
    if (query.data !== undefined) {
        return query.isFetching
            ? { status: 'loading', trigger: retry }
            : {
                  status: 'done',
                  result: query.data.data,
                  plain: query.data.plain,
                  trigger: retry,
              };
    }

    if (query.isError) {
        if (isAwaitingInteraction) {
            // 게이트가 열려 다시 부르는 동안에는 React Query가 직전 오류를 유지한다 —
            // 그대로 두면 생성이 도는 내내 "AI 분석 시작" 버튼이 남는다.
            return query.isFetching
                ? { status: 'loading', trigger: retry }
                : { status: 'awaiting_interaction', trigger: retry };
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

    return { status: 'loading', trigger: retry };
}
