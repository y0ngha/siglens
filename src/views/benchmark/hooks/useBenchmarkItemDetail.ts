'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchBenchmarkItemDetail } from '../lib/fetchBenchmarkItemDetail';

/** 측정이 끝난 정적 파일이라 다시 받을 이유가 없다. */
const STATIC_FILE_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/**
 * 펼친 문항의 상세(답변 원문·추출값·심사 결과)를 받아 온다. 펼친 행에서만 마운트되므로
 * 접힌 행은 요청을 만들지 않는다.
 */
export function useBenchmarkItemDetail(round: string, qid: string) {
    return useQuery({
        queryKey: ['benchmark', 'item', round, qid] as const,
        queryFn: ({ signal }) => fetchBenchmarkItemDetail(round, qid, signal),
        staleTime: STATIC_FILE_STALE_TIME_MS,
    });
}
