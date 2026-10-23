import {
    benchmarkItemDetailPath,
    isBenchmarkItemDetail,
} from '@/entities/benchmark/lib/itemDetail';
import type { BenchmarkItemDetail } from '@/entities/benchmark/types';

/**
 * 문항 상세를 받아 온다. 실패는 던진다 — 호출부(React Query)가 에러 상태로 바꾼다.
 * 부수효과(fetch)는 view에 둔다(EN-1) — entities는 경로 조립·형태 검증 같은 순수 함수만 갖는다.
 */
export async function fetchBenchmarkItemDetail(
    round: string,
    qid: string,
    signal?: AbortSignal
): Promise<BenchmarkItemDetail> {
    const response = await fetch(benchmarkItemDetailPath(round, qid), {
        signal,
    });
    if (!response.ok) {
        throw new Error(
            `[benchmark] item ${qid} request failed: ${response.status}`
        );
    }
    const body: unknown = await response.json();
    if (!isBenchmarkItemDetail(body) || body.qid !== qid) {
        throw new Error(`[benchmark] item ${qid} has an unexpected shape`);
    }
    return body;
}
