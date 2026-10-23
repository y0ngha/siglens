import {
    buildBenchmarkHeadline,
    type BenchmarkContrastVerdict,
} from '@/entities/benchmark/lib/benchmarkHeadline';
import type {
    BenchmarkRelease,
    BenchmarkTarget,
} from '@/entities/benchmark/types';
import {
    formatBenchmarkContrast,
    formatBenchmarkScore,
    type BenchmarkContrastText,
} from '@/shared/lib/benchmarkFormat';

export interface SummaryEntry extends BenchmarkContrastText {
    readonly target: BenchmarkTarget;
    readonly verdict: BenchmarkContrastVerdict;
}

export interface SummaryHeadline {
    readonly subject: BenchmarkTarget;
    readonly competitors: readonly SummaryEntry[];
    /** 비교 주체의 L5 중립 심사 평균, 서식을 입힌 값. */
    readonly l5Text: string;
}

/**
 * 요약 카드용 헤드라인. 상세 페이지와 같은 분류(`buildBenchmarkHeadline`)에서 오되 경쟁 모델 전부에
 * 표시 문자열을 입힌다. 비교할 주체가 없으면 `null`이다.
 */
export function buildSummaryHeadline(
    release: BenchmarkRelease
): SummaryHeadline | null {
    const headline = buildBenchmarkHeadline(release);
    if (headline === null) return null;
    return {
        subject: headline.subject,
        competitors: headline.competitors.map(entry => ({
            target: entry.target,
            verdict: entry.verdict,
            ...formatBenchmarkContrast(entry.contrast),
        })),
        l5Text: formatBenchmarkScore(headline.l5Score),
    };
}
