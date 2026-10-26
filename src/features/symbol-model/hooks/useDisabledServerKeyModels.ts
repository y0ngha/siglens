'use client';

import { useQuery } from '@tanstack/react-query';
import type { ModelId } from '@y0ngha/siglens-core';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { fetchDisabledServerKeyModels } from '../lib/fetchDisabledServerKeyModels';

const NONE: readonly ModelId[] = [];

export interface DisabledServerKeyModels {
    /** 운영자가 꺼 둔 서버 키 모델. 받기 전·실패 시에는 빈 목록이다. */
    models: readonly ModelId[];
    /**
     * 조회가 끝났는가(성공이든 실패든). 저장된 선택을 읽는 시점을 여기까지 미룬다 —
     * 목록보다 먼저 읽으면 꺼진 모델로 첫 분석이 나가고, 목록이 도착해 선택이 강등되며
     * 같은 분석이 한 번 더 나간다.
     */
    isSettled: boolean;
}

/**
 * 운영자가 꺼 둔 서버 키 모델(`SERVER_KEY_DISABLED_PROVIDERS`).
 *
 * 실패해도 빈 목록으로 진행한다 — 그 사이 꺼진 모델로 분석이 나가도 서버가 기본 모델로
 * 바꿔 돌린다(`/api/analysis/stream`의 `resolveRequestModel`).
 */
export function useDisabledServerKeyModels(): DisabledServerKeyModels {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery({
        queryKey: QUERY_KEYS.disabledServerKeyModels(),
        queryFn: fetchDisabledServerKeyModels,
        enabled: isHydrated,
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: false,
    });
    return { models: data ?? NONE, isSettled: !isPending };
}
