'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ModelId,
    OverallAnalysisResponse,
    OverallAxis,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';
import type { RunOverallAnalysisActionResult as CoreOverallResult } from '@/entities/analysis/actions';

/**
 * 재분석 의도로 보낸 요청인데 서버가 쿨다운을 획득하지 못한 경우의 응답.
 * 쿨다운 획득은 서버가 단독으로 하므로 이 응답이 클라이언트가 쿨다운을 아는 유일한 경로다.
 */
type RunOverallAnalysisActionResult =
    | CoreOverallResult
    | { status: 'reanalyze_cooldown'; remainingMs: number };
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';
import type { OverallAnalysisState } from '../types';

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    trigger: () => void;
}

/**
 * submitOverallAnalysisAction이 axis 정보와 함께 에러를 돌려줄 수 있어
 * 커스텀 에러 클래스로 axis를 보존한다. 게이트 오류(AnalysisGateBlockedResult)는
 * axis가 없으므로 undefined로 전달된다.
 */
class OverallAnalysisError extends Error {
    constructor(
        message: string,
        public readonly axis?: OverallAxis
    ) {
        super(message);
        this.name = 'OverallAnalysisError';
    }
}

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 dependency 단계·poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    options: { reasoning?: boolean; reanalyze?: boolean } = {},
    signal?: AbortSignal
): Promise<OverallAnalysisResponse> {
    // `force`(캐시 우회) 자체는 보내지 않는다 — 인증 없는 공개 라우트라 클라이언트가
    // 우회를 지시할 수 있으면 안 된다. 대신 **의도**(`reanalyze`)만 보내고, 서버가
    // 재분석 쿨다운을 획득했을 때만 실제로 우회한다.
    const result = await runAnalysisStream<RunOverallAnalysisActionResult>({
        type: 'overall',
        params: { symbol, companyName, timeframe, modelId, ...options },
        signal,
    });

    if (result.status === 'reanalyze_cooldown') {
        throw new OverallAnalysisError(
            `재분석은 잠시 후에 가능해요. ${Math.ceil(result.remainingMs / 1000)}초 뒤에 다시 시도해 주세요.`
        );
    }

    if (result.status === 'cached' || result.status === 'done')
        return result.result;

    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }

    if (result.status === 'error') {
        if (isGateBlockedResult(result)) {
            throw new OverallAnalysisError(result.error.message, undefined);
        }
        throw new OverallAnalysisError(
            typeof result.error === 'string'
                ? result.error
                : '분석 중 오류가 발생했습니다.',
            result.axis
        );
    }

    if (result.status === 'limit_error') {
        throw new OverallAnalysisError(
            '오늘 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요.'
        );
    }
    if (result.status === 'key_error') {
        throw new OverallAnalysisError(result.error, undefined);
    }

    throw new OverallAnalysisError('예상치 못한 오류가 발생했습니다.');
}

export function useOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    /**
     * 서버에서 peek로 미리 읽은 캐시 분석 서사(SSR seed). 주어지면 마운트 즉시
     * done 상태로 보여 준다. staleTime: Infinity가 자동 재요청을 막으므로
     * seed가 있어도 LLM 생성은 트리거되지 않는다(순수 additive).
     *
     * staleTime: Infinity라 seed된 query는 자동 갱신되지 않는다. 그러나 timeframe
     * 변경 시 queryKey가 바뀌어 이 initialData(seed)는 옛 key에만 적용되고 새 key는
     * 빈 상태에서 시작하므로, "절대 갱신 안 됨" 사각지대는 생기지 않는다. 동일
     * 세션·동일 timeframe에서의 명시적 갱신은 재분석(trigger force)으로 처리된다.
     */
    initialResult?: OverallAnalysisResponse,
    /**
     * Asset class of the symbol being analysed.
     * Crypto runs on technical + news only — fundamental and options axes are
     * never submitted for crypto symbols (handled server-side by runOverallAnalysis).
     * Defaults to 'equity' so existing callers that don't yet pass this param
     * continue to get the full 4-axis behaviour.
     */
    _assetClass: AssetClass = 'equity',
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false`. Part of the query key so toggling
     * re-submits analysis (distinct cache key).
     */
    reasoning = false
): UseOverallAnalysisReturn {
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();
    const [triggered, setTriggered] = useState(initialResult !== undefined);
    // 다음 queryFn 호출이 "사용자가 누른 재분석"인지 표시한다. state가 아니라 ref인
    // 이유: 값이 바뀌어도 렌더는 필요 없고, refetch가 곧바로 읽어가야 한다.
    const reanalyzeIntentRef = useRef(false);
    const queryKey = useMemo(
        () =>
            QUERY_KEYS.overallAnalysis(
                symbol,
                companyName,
                timeframe,
                modelId,
                reasoning
            ),
        [symbol, companyName, timeframe, modelId, reasoning]
    );
    // queryKey를 ref에 캡처해 mount 시 최초 렌더 기준으로 캐시를 확인한다.
    const queryKeyRef = useRef(queryKey);

    const query = useQuery({
        queryKey,
        queryFn: ({
            signal,
            queryKey: [
                ,
                qSymbol,
                qCompanyName,
                qTimeframe,
                qModelId,
                qReasoning,
            ],
        }) => {
            const reanalyze = reanalyzeIntentRef.current;
            reanalyzeIntentRef.current = false;
            return fetchOverallAnalysis(
                qSymbol,
                qCompanyName,
                qTimeframe,
                qModelId,
                { reasoning: qReasoning, ...(reanalyze ? { reanalyze } : {}) },
                signal
            );
        },
        enabled: isHydrated && triggered,
        retry: false,
        staleTime: Infinity,
        // SSR seed: 캐시 HIT면 마운트 시점부터 query.data가 채워져 있어 즉시 done.
        initialData: initialResult,
    });

    const state = useMemo((): OverallAnalysisState => {
        if (!triggered) return { status: 'idle' };
        if (query.isError) {
            const err = query.error;
            if (err instanceof BotBlockedError) {
                return { status: 'bot_blocked' };
            }
            return {
                status: 'error',
                error:
                    err instanceof Error
                        ? err.message
                        : '분석 중 오류가 발생했습니다.',
                axis:
                    err instanceof OverallAnalysisError ? err.axis : undefined,
            };
        }
        if (query.data !== undefined)
            return { status: 'done', result: query.data };
        return { status: 'submitting' };
    }, [triggered, query.isError, query.error, query.data]);

    const { refetch } = query;
    const trigger = useCallback(() => {
        if (!triggered) {
            setTriggered(true);
        } else {
            // 이미 결과가 있는 상태의 trigger = 사용자가 누른 재분석. 의도를 표시하고
            // refetch한다. 캐시 우회 여부는 서버가 쿨다운 획득으로 판단한다.
            reanalyzeIntentRef.current = true;
            void refetch();
        }
    }, [triggered, refetch]);

    useEffect(() => {
        if (queryClient.getQueryData(queryKeyRef.current) !== undefined) {
            setTriggered(true);
        }
    }, [queryClient]);

    return { state, trigger };
}
