'use client';

import { useQuery } from '@tanstack/react-query';
import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import { QUERY_KEYS } from '@/lib/queryConfig';
import type {
    MarketBriefingResponse,
    SubmitBriefingResult,
} from '@/domain/types';

const POLL_INTERVAL_MS = 5_000;

interface UseBriefingResult {
    briefing: MarketBriefingResponse;
    generatedAt: string;
}

// 로딩 중에는 Promise를, 에러 시에는 Error를 throw한다 — 호출부는 <Suspense> + <ErrorBoundary>로 감싼다.
// 반환값 null은 briefing이 요청되지 않은 상태(input이 없음)를 뜻한다.
export function useBriefing(
    input: SubmitBriefingResult | undefined
): UseBriefingResult | null {
    const jobId = input?.status === 'submitted' ? input.jobId : undefined;

    const { data, error } = useQuery({
        queryKey: QUERY_KEYS.briefing(jobId ?? ''),
        queryFn: () => pollBriefingAction(jobId!),
        enabled: !!jobId,
        refetchInterval: query => {
            const status = query.state.data?.status;
            return status === 'done' || status === 'error'
                ? false
                : POLL_INTERVAL_MS;
        },
        staleTime: Infinity,
    });

    if (!input) return null;

    if (input.status === 'cached') {
        return {
            briefing: input.briefing,
            generatedAt: input.generatedAt,
        };
    }

    if (error) throw error;
    if (!data || data.status === 'processing') {
        throw new Promise<void>(() => undefined);
    }
    if (data.status === 'error') throw new Error(data.error);

    return { briefing: data.briefing, generatedAt: data.generatedAt };
}
