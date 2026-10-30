'use client';

/**
 * 수급 AI 해석 분석 훅 — 쿼리 한 개로 로딩·완료·데이터 없음·상호작용 대기·오류를 하나의 상태로 낸다.
 */
import { useTranslations } from 'next-intl';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useQuery } from '@tanstack/react-query';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import type {
    InvestorFlowsAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import type { RunInvestorFlowsActionResult } from '@/entities/analysis/actions/runInvestorFlowsAction';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis/lib/gate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import { useRefetchWhenAllowed } from '@/shared/hooks/useRefetchWhenAllowed';

/**
 * `no_data` 결과를 React Query `queryFn`(데이터를 돌려주거나 던지기만 할 수 있다)에서 훅의 상태 기계로
 * 옮기는 표식 예외 — 훅에서 `{ status: 'no_data' }`로 바뀐다.
 *
 * 수급 데이터가 없는 종목은 오류가 아니다(신규 상장·미매핑 CUSIP·소형주). AI를 부르지 않으므로 캐시에
 * 가짜 응답 객체를 넣지 않고 "정착했지만 데이터 없음"으로 다룬다.
 */
class NoInvestorFlowsDataError extends Error {
    constructor() {
        super('no_data');
        this.name = 'NoInvestorFlowsDataError';
    }
}

/** 훅이 돌려주는 상태. `trigger`는 대기 중인 분석을 시작하고, 오류일 때만 `retry`가 따로 있다. */
export type InvestorFlowsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: InvestorFlowsAnalysisResponse;
          trigger: () => void;
      }
    | { status: 'no_data'; trigger: () => void }
    | { status: 'awaiting_interaction'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/** run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다. `done`은 `cached`와 같이 `result`를 반환한다. */
async function fetchInvestorFlowsAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    messages: StreamErrorMessages,
    signal?: AbortSignal,
    cacheOnly = false
): Promise<InvestorFlowsAnalysisResponse> {
    const result = await runAnalysisStream<RunInvestorFlowsActionResult>({
        type: 'investorFlows',
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
        return result.result;
    // `miss_no_trigger`: AI 자동 실행 게이트가 막은 상태의 캐시 전용 조회가 미스였다
    // (`useAiAutoRunAllowed`). 오류가 아니라 대기 상태다 — 입력이 들어오면 다시 부른다.
    if (result.status === 'miss_no_trigger')
        throw new AwaitingInteractionError();
    if (result.status === 'no_data') throw new NoInvestorFlowsDataError();
    if (result.status === 'error') {
        // BYOK/tier 게이트 차단(AnalysisGateBlockedResult)과 core의 fetch_failed(문자열 error)는
        // 같은 `status: 'error'`의 두 변형이다.
        if (isGateBlockedResult(result)) throw new Error(result.error.message);
        // core가 채우는 `result.error`는 영어 예외 문자열이라 화면에 내지 않는다.
        if (result.error)
            console.error('[investorFlowsFetchFailed]', result.error);
        throw new Error(messages.fetchFailed);
    }
    throw new Error(messages.unexpected);
}

/** 종목·모델·추론 여부를 키로 수급 AI 해석을 한 번 불러온다(캐시가 있으면 재사용). */
export function useInvestorFlowsAnalysis(
    symbol: string,
    modelId: ModelId,
    /** Member "깊은 생각" toggle. 쿼리 키의 일부라 토글하면 다른 캐시 키로 다시 요청한다. */
    reasoning = false,
    /** `modelId`/`reasoning`이 확정값인지 여부(`useAnalysisSettingsHydrated()`). 기본값 `true`는 단위 테스트용. */
    isSettingsHydrated = true,
    /**
     * AI 분석을 생성까지 요청해도 되는지(`useAiAutoRunAllowed().allowed`). `false`면 캐시만 조회하고,
     * 미스면 `awaiting_interaction`으로 둔다. 기본값 `true`는 단위 테스트와 게이트가 필요 없는 호출부용이다.
     */
    autoRunAllowed = true
): InvestorFlowsAnalysisState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    const query = useQuery({
        queryKey: QUERY_KEYS.investorFlows(symbol, modelId, reasoning, locale),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchInvestorFlowsAnalysis(
                qSymbol,
                qModelId,
                qReasoning,
                streamMessages,
                signal,
                !autoRunAllowed
            ),
        // 캐시가 없을 때만 1회 자동 실행한다. staleTime: Infinity라 캐시가 있으면 조용히 재사용되고,
        // 포커스/재연결 재요청은 꺼서 실패 이후 창 포커스만으로 AI 분석이 다시 도는 것을 막는다.
        enabled: isSettingsHydrated,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const isAwaitingInteraction =
        query.error instanceof AwaitingInteractionError;
    // `isAwaitingInteraction`이 입력이라 파생값 바로 뒤에 둔다(REACT.md#HK-1의 문서화된 예외).
    useRefetchWhenAllowed(autoRunAllowed, isAwaitingInteraction, refetch);

    const retry = () => {
        void refetch();
    };

    if (query.isError) {
        if (isAwaitingInteraction) {
            // 게이트가 열려 다시 부르는 동안에는 React Query가 직전 오류를 유지한다 — 그대로 두면
            // 생성이 도는 내내 "AI 분석 시작" 버튼이 남는다.
            return query.isFetching
                ? { status: 'loading', trigger: retry }
                : { status: 'awaiting_interaction', trigger: retry };
        }
        if (query.error instanceof NoInvestorFlowsDataError) {
            return { status: 'no_data', trigger: retry };
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
        return { status: 'done', result: query.data, trigger: retry };
    }

    return { status: 'loading', trigger: retry };
}
