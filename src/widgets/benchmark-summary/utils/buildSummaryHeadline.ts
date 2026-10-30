/**
 * 요약 카드가 그리는 헤드라인 데이터. 도메인 분류는 entity가, 표시 문자열은 `shared/lib`가 정하고
 * 여기서는 둘을 카드 한 장 단위로 묶기만 한다.
 */
import {
    buildBenchmarkHeadline,
    withSubjectLabel,
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

/** 경쟁 모델 카드 한 장. */
export interface SummaryEntry extends BenchmarkContrastText {
    readonly target: BenchmarkTarget;
    readonly verdict: BenchmarkContrastVerdict;
    /** 이 비교에 쓴 문항 수. 비교마다 다를 수 있어(두 대상이 모두 답한 문항) 카드마다 싣는다. */
    readonly questionCount: number;
}

/** 요약 섹션 전체가 읽는 값. */
export interface SummaryHeadline {
    /** 비교 주체. 라벨은 호출자가 넘긴 브랜드 표기다. */
    readonly subject: BenchmarkTarget;
    readonly competitors: readonly SummaryEntry[];
    /** 비교 주체의 L5 중립 심사 평균, 서식을 입힌 값. */
    readonly l5Text: string;
}

/**
 * 요약 카드용 헤드라인. 상세 페이지와 같은 분류(`buildBenchmarkHeadline`)에서 오되 경쟁 모델 전부에
 * 표시 문자열을 입힌다. 주체는 `subjectLabel`(브랜드 표기)로 부르고 경쟁 모델은 데이터 라벨 그대로다.
 * 비교할 주체가 없으면 `null`이다.
 */
export function buildSummaryHeadline(
    release: BenchmarkRelease,
    subjectLabel: string
): SummaryHeadline | null {
    const headline = buildBenchmarkHeadline(
        withSubjectLabel(release, subjectLabel)
    );
    if (headline === null) return null;
    return {
        subject: headline.subject,
        competitors: headline.competitors.map(entry => ({
            target: entry.target,
            verdict: entry.verdict,
            questionCount: entry.contrast.n,
            ...formatBenchmarkContrast(entry.contrast),
        })),
        l5Text: formatBenchmarkScore(headline.l5Score),
    };
}
