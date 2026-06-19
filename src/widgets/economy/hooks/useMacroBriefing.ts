'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    MacroBriefingResponse,
    SubmitMacroBriefingCached,
    SubmitMacroBriefingResult,
} from '@y0ngha/siglens-core';

import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import { useHydrated } from '@/shared/hooks/useHydrated';
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
 * - `SubmitMacroBriefingResult`: 정상 — cached면 본문 렌더, submitted면 poll로 위임.
 *
 * seed 경유의 cached variant는 generatedAt이 null일 수 있다(아직 서버에서
 * 생성된 타임스탬프가 없는 초기 peekSeed 표시 단계). 빈 문자열 sentinel 대신
 * null로 명시해 타입을 더 정확하게 표현한다.
 */
export type MacroBriefingInput =
    | SubmitMacroBriefingResult
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
 * 마운트 후 `submitMacroBriefingAction`을 호출해 거시 브리핑을 트리거한다.
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
    const { data, refetch: queryRefetch } = useQuery({
        queryKey: QUERY_KEYS.macroBriefing(),
        queryFn: submitMacroBriefingAction,
        enabled: isHydrated,
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

    if (!data) return { input: seedInput, refetch };
    if ('ok' in data) return { input: 'error', refetch };
    if (data.botBlocked) return { input: null, refetch };
    return { input: data.briefing, refetch };
}
