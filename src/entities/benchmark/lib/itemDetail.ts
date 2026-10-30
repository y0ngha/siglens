import { isPlainRecord } from '@/shared/lib/isPlainRecord';
import {
    BENCHMARK_JUDGED_LEVELS,
    BENCHMARK_LABELS,
    type BenchmarkItemDetail,
} from '../types';

/**
 * 문항 상세 정적 파일의 사이트 경로. 로케일 접두사가 없다 — `public/` 파일이라
 * 어느 호스트·로케일에서도 같은 경로로 받는다.
 */
export function benchmarkItemDetailPath(round: string, qid: string): string {
    return `/benchmark/${encodeURIComponent(round)}/items/${encodeURIComponent(qid)}.json`;
}

function isRoundDetail(value: unknown): boolean {
    return (
        isPlainRecord(value) &&
        typeof value.round === 'number' &&
        typeof value.answerText === 'string' &&
        Array.isArray(value.extracted) &&
        value.extracted.every(
            extracted =>
                isPlainRecord(extracted) &&
                typeof extracted.part === 'string' &&
                (extracted.value === null ||
                    typeof extracted.value === 'string') &&
                (BENCHMARK_LABELS as readonly unknown[]).includes(
                    extracted.verdict
                ) &&
                (extracted.reason === null ||
                    typeof extracted.reason === 'string')
        )
    );
}

function isJudgement(value: unknown): boolean {
    return (
        isPlainRecord(value) &&
        typeof value.target === 'string' &&
        (BENCHMARK_JUDGED_LEVELS as readonly unknown[]).includes(value.level) &&
        typeof value.judge === 'string' &&
        typeof value.round === 'number' &&
        Number.isInteger(value.round) &&
        value.round >= 1 &&
        typeof value.score === 'number' &&
        typeof value.why === 'string'
    );
}

/** 받은 JSON이 `BenchmarkItemDetail`인지 확인한다 — 형태가 어긋난 파일을 화면이 그대로 읽지 않게 한다. */
export function isBenchmarkItemDetail(
    value: unknown
): value is BenchmarkItemDetail {
    if (!isPlainRecord(value) || typeof value.qid !== 'string') return false;
    if (!isPlainRecord(value.targets)) return false;
    const targetsOk = Object.values(value.targets).every(
        rounds => Array.isArray(rounds) && rounds.every(isRoundDetail)
    );
    return (
        targetsOk &&
        Array.isArray(value.judgements) &&
        value.judgements.every(isJudgement)
    );
}
