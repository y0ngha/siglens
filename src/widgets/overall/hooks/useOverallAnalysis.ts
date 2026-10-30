'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import type {
    ModelId,
    OverallAnalysisResponse,
    Timeframe,
} from '@y0ngha/siglens-core';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { OverallAnalysisState } from '../types';
import { deriveOverallState } from '../utils/deriveOverallState';
import { fetchOverallAnalysis } from '../utils/fetchOverallAnalysis';
import { useMountScopedSeed } from './useMountScopedSeed';
import { useOverallRequestIntent } from './useOverallRequestIntent';

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    /**
     * 분석을 시작하거나 오류 뒤 다시 시도한다. 일반 요청이라 캐시를 우회하지 않는다.
     * 이미 결과가 있거나 요청이 진행 중이면 아무것도 하지 않는다.
     */
    trigger: () => void;
    /**
     * 사용자가 누른 재분석. 재분석 **의도**만 보내고, 캐시 우회 여부는 서버가 쿨다운
     * 획득으로 정한다. 진행 중인 요청이 있으면 취소하지 않고 무시한다.
     */
    reanalyze: () => void;
}

/**
 * 종합 분석 쿼리 훅. 생성은 사용자가 요청(`trigger`/`reanalyze`)한 뒤에만 일어난다.
 *
 * `initialResult`(SSR seed)는 마운트 시점 key의 결과를 즉시 보여 줄 뿐 생성을 허락하지
 * 않는다. 하이드레이션 뒤 key가 바뀌면(저장된 모델·깊은 생각·유료 timeframe) 새 key는
 * 캐시만 읽고, 미스면 CTA로 돌아가 클릭을 기다린다. React Query 캐시에 이미 있는 key의
 * 결과는 클릭 없이 보인다.
 */
export function useOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    /** 서버에서 peek로 미리 읽은 캐시 분석 서사(SSR seed). 마운트 key에만 적용된다. */
    initialResult?: OverallAnalysisResponse,
    /** 회원 "깊은 생각" 토글. 쿼리 키의 일부라 토글하면 별도 캐시 key로 분석한다. */
    reasoning = false,
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated = true
): UseOverallAnalysisReturn {
    const tError = useTranslations('shared.ui.analysisError');
    const streamMessages = useStreamErrorMessages();
    // 로케일이 키에 들어가야 ko에서 본 결과가 ja 화면에 재사용되지 않는다.
    const locale = useCurrentLocale();
    const intent = useOverallRequestIntent();
    const queryKey = QUERY_KEYS.overallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId,
        reasoning,
        locale
    );
    // 입력(queryKey)이 파생값이라 그 바로 뒤에 선언한다(HK-1 예외).
    const seed = useMountScopedSeed(queryKey, initialResult);
    const isRequested =
        intent.isGenerationAuthorized || initialResult !== undefined;
    const isEnabled = isSettingsHydrated && isRequested;

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
        }) =>
            fetchOverallAnalysis(
                {
                    symbol: qSymbol,
                    companyName: qCompanyName,
                    timeframe: qTimeframe,
                    modelId: qModelId,
                    reasoning: qReasoning,
                    intent: intent.consumeIntent(),
                },
                streamMessages,
                signal
            ),
        enabled: isEnabled,
        retry: false,
        // 오류 뒤 창 포커스·재연결만으로 AI 분석이 다시 도는 것을 막는다.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        // SSR seed는 서버에서 peek로 읽은 서사라 평이화 산문이 없다 — `plain: null`.
        // 사용자가 재분석하면 스트림이 `plain`을 채워 준다.
        initialData:
            seed === undefined ? undefined : { data: seed, plain: null },
    });

    const { data, error, isFetching, refetch } = query;
    const fallbackMessage = tError('analysisFailed');
    const state = useMemo(
        () =>
            deriveOverallState({
                data,
                error,
                isFetching,
                isRequested,
                fallbackMessage,
            }),
        [data, error, isFetching, isRequested, fallbackMessage]
    );

    const trigger = () => {
        if (isFetching || data !== undefined) return;
        intent.authorizeGeneration();
        // 이미 켜진 쿼리(seed의 캐시 미스·오류)는 자동으로 다시 돌지 않는다.
        // 아직 꺼져 있었다면 허락으로 켜지는 순간 스스로 돈다.
        if (isEnabled) void refetch({ cancelRefetch: false });
    };

    const reanalyze = () => {
        if (isFetching) return;
        intent.markReanalyze();
        void refetch({ cancelRefetch: false }).finally(intent.clearReanalyze);
    };

    return { state, trigger, reanalyze };
}
