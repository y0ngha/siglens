import { roundBenchmarkScore } from '@/shared/lib/benchmarkFormat';
import {
    BENCHMARK_SUBJECT_ID,
    type BenchmarkContrast,
    type BenchmarkRelease,
    type BenchmarkTarget,
} from '../types';

/** Holm 보정 p값이 이 값 미만이면 유의하다고 읽는다. */
export const BENCHMARK_SIGNIFICANCE_LEVEL = 0.05;

/**
 * 비교 한 건의 해석.
 * - `ahead`/`behind`: 검정했고(Holm p < α) 신뢰구간이 0을 포함하지 않는다.
 * - `tie`: 검정했지만 차이를 확정하지 못했다.
 * - `untested`: 검정하지 않았다(p값 없음, 기준선). 앞섬·뒤처짐으로 세지 않는다.
 */
export type BenchmarkContrastVerdict = 'ahead' | 'behind' | 'tie' | 'untested';

export interface BenchmarkHeadlineEntry {
    readonly target: BenchmarkTarget;
    readonly contrast: BenchmarkContrast;
    readonly verdict: BenchmarkContrastVerdict;
}

export interface BenchmarkHeadline {
    readonly subject: BenchmarkTarget;
    /** 경쟁 모델(기준선 제외)과의 비교. */
    readonly competitors: readonly BenchmarkHeadlineEntry[];
    /** 같은 내부 모델에 도구 없이 물은 기준선과의 비교. */
    readonly baselines: readonly BenchmarkHeadlineEntry[];
    /** 경쟁 모델 비교의 해석별 개수. 헤드라인 문장·메타 설명이 이 값을 읽는다. */
    readonly counts: Readonly<Record<BenchmarkContrastVerdict, number>>;
    /** 비교 주체의 L5(정직성·안전) 중립 심사 평균(0~1). 칸에 문항이 없으면 null. */
    readonly l5Score: number | null;
}

/**
 * Holm 보정 p값이 숫자이고 유의 수준 미만이며 신뢰구간이 0을 포함하지 않아야 앞섬/뒤처짐이다.
 * p값이 없으면 검정하지 않은 비교(`untested`)이고 신뢰구간만으로 앞섬을 주장하지 않는다.
 */
export function classifyContrast(
    contrast: BenchmarkContrast
): BenchmarkContrastVerdict {
    if (contrast.pHolm === null) return 'untested';
    // 화면에 찍히는 값(소수 셋째 자리)으로 판정한다. 표에 "0.050"이 보이는데 유의하다고
    // 읽거나, 하한이 "0.000"으로 보이는데 0을 배제한다고 읽으면 화면과 문장이 어긋난다.
    const p = roundBenchmarkScore(contrast.pHolm);
    if (p >= BENCHMARK_SIGNIFICANCE_LEVEL) return 'tie';
    const lower = roundBenchmarkScore(contrast.ci95[0]);
    const upper = roundBenchmarkScore(contrast.ci95[1]);
    if (lower > 0) return 'ahead';
    if (upper < 0) return 'behind';
    return 'tie';
}

/**
 * 헤드라인의 도메인 분류. 문자열 서식은 화면 쪽(`shared/lib/benchmarkFormat.ts`)이 입힌다.
 * 비교의 주체(`siglens`)가 없으면 null.
 */
export function buildBenchmarkHeadline(
    release: BenchmarkRelease
): BenchmarkHeadline | null {
    const subject = release.targets.find(t => t.id === BENCHMARK_SUBJECT_ID);
    if (subject === undefined) return null;
    const entries = release.headline.flatMap(contrast => {
        const target = release.targets.find(t => t.id === contrast.target);
        if (target === undefined) return [];
        return [
            {
                target,
                contrast,
                verdict: classifyContrast(contrast),
            },
        ];
    });
    const competitors = entries.filter(e => !e.target.isBaseline);
    const baselines = entries.filter(e => e.target.isBaseline);
    const count = (verdict: BenchmarkContrastVerdict): number =>
        competitors.filter(e => e.verdict === verdict).length;
    return {
        subject,
        competitors,
        baselines,
        counts: {
            ahead: count('ahead'),
            behind: count('behind'),
            tie: count('tie'),
            untested: count('untested'),
        },
        l5Score: release.breakdown.judged.L5[subject.id] ?? null,
    };
}

/**
 * 비교 주체의 표시 이름만 바꾼 릴리스. 주체는 화면 어디서나 브랜드 표기(로케일별)로 불러야 하고
 * 데이터의 라벨(`AlphaAI` 등)은 경쟁 모델과 같은 원자료 표기라 그대로 둘 수 없다. 경쟁 모델은
 * 데이터 라벨을 유지한다.
 */
export function withSubjectLabel(
    release: BenchmarkRelease,
    label: string
): BenchmarkRelease {
    return {
        ...release,
        targets: release.targets.map(target =>
            target.id === BENCHMARK_SUBJECT_ID ? { ...target, label } : target
        ),
    };
}
