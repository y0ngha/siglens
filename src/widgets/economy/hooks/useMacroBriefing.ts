'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    MacroBriefingResponse,
    SubmitMacroBriefingCached,
    RunMacroBriefingResult,
} from '@y0ngha/siglens-core';

import { useHydrated } from '@/shared/hooks/useHydrated';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import type { MacroBriefingActionResult } from '@/shared/lib/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/**
 * peekSeed 경유의 초기 표시용 cached variant — 서버 generatedAt 없이 briefing만 있다.
 * core의 `SubmitMacroBriefingCached`를 확장해 `generatedAt`을 null로 오버라이드한다.
 * (core는 generatedAt을 string으로 강제하지만, seed 단계는 아직 서버 타임스탬프가 없다.)
 */
export interface SeedMacroBriefingCached extends Omit<
    SubmitMacroBriefingCached,
    'generatedAt'
> {
    generatedAt: null;
}

/**
 * 브리핑 위젯의 단일 union 상태 — 위젯이 단일 switch로 분기한다.
 * - `undefined`(loading): 트리거 전(미하이드레이션 또는 fetching 중).
 * - `null`(botBlocked): 봇 차단 안내.
 * - `'error'`: server action이 ok=false를 반환했을 때 inline notice 렌더.
 * - `RunMacroBriefingResult`: 정상 — cached/done 모두 본문 렌더.
 *
 * seed 경유의 cached variant는 generatedAt이 null일 수 있다(아직 서버에서
 * 생성된 타임스탬프가 없는 초기 peekSeed 표시 단계). 빈 문자열 sentinel 대신
 * null로 명시해 타입을 더 정확하게 표현한다.
 */
export type MacroBriefingInput =
    | RunMacroBriefingResult
    | SeedMacroBriefingCached
    | null
    | 'error'
    | undefined;

export interface UseMacroBriefingReturn {
    input: MacroBriefingInput;
    /** Re-triggers the submit action. Call when `input === 'error'` to retry. */
    refetch: () => void;
}

/**
 * 마운트 후 SSE 스트림으로 거시 브리핑을 트리거한다.
 * peekSeed가 있으면 초기 표시(generatedAt이 null) 후 action 결과로 교체.
 * 봇이면 null, server action 실패면 'error'(inline notice). market briefing 훅과
 * 동일한 골격이되 silent infinite skeleton 회귀 방지를 위해 error variant 명시.
 */
export function useMacroBriefing(
    peekSeed?: MacroBriefingResponse | null
): UseMacroBriefingReturn {
    const isHydrated = useHydrated();

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below.
    const {
        data,
        isError,
        refetch: queryRefetch,
    } = useQuery({
        queryKey: QUERY_KEYS.macroBriefing(),
        queryFn: ({ signal }) =>
            runAnalysisStream<MacroBriefingActionResult>({
                type: 'macroBriefing',
                params: {},
                signal,
            }),
        enabled: isHydrated,
        // 전역 기본값 retry:1을 끈다 — 실패한 분석을 자동 재시도하면 방문자마다
        // LLM 왕복이 두 번 돈다. 재시도는 사용자가 명시적으로 요청할 때만.
        retry: false,
        staleTime: Infinity,
    });

    const refetch = useCallback(() => {
        void queryRefetch();
    }, [queryRefetch]);

    const seedInput = useMemo<SeedMacroBriefingCached | undefined>(
        () =>
            peekSeed
                ? { status: 'cached', briefing: peekSeed, generatedAt: null }
                : undefined,
        [peekSeed]
    );

    // 스트림이 error 이벤트로 끝나면 `runAnalysisStream`이 throw하므로 data가 없다 —
    // 이때 seedInput(대개 undefined)으로 떨어지면 스켈레톤이 영원히 남는다.
    if (isError) return { input: 'error', refetch };
    if (!data) return { input: seedInput, refetch };
    if ('ok' in data) return { input: 'error', refetch };
    if (data.botBlocked) return { input: null, refetch };
    return { input: data.briefing, refetch };
}
