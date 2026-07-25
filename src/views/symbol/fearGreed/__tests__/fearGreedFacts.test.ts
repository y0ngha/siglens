import { describe, it, expect } from 'vitest';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    buildFearGreedFactorLines,
    buildFearGreedGroupComparisonLine,
    buildFearGreedFactorRankingLine,
} from '../utils/fearGreedFacts';
import { FACTOR_LABEL, formatFactorRaw } from '@/shared/lib/fearGreedLabels';

/**
 * factorInterpretation은 3구간(<25 low / >=75 high / 그 사이 middle)이다.
 * 감사 지적: <25 구간이 어떤 기존 테스트에서도 실행된 적이 없고, 해석 문구
 * 자체(각 구간의 리터럴 텍스트)도 단언된 적이 없었다. 이 스위트는 경계값
 * (24/25, 74/75)을 포함해 세 구간 전부와 완성된 한 줄 문장 텍스트를 검증한다.
 */
function buildSnapshot(percentile: number): FearGreedSnapshot {
    return {
        score: 50,
        label: 'NEUTRAL',
        groups: [
            {
                name: 'Flow',
                score: 50,
                factors: [{ key: 'volume_z', rawValue: 1.2345, percentile }],
            },
        ],
        confidence: 'normal',
        sampleSize: 220,
        warning: null,
    };
}

function expectedLine(percentile: number, interpretation: string): string {
    const pctile = Math.round(percentile);
    // FIX 6 (audit): "82th 퍼센타일" mixed an English ordinal suffix into
    // Korean text — native Korean ordinal "번째" replaces it.
    return `${FACTOR_LABEL.volume_z}: ${formatFactorRaw('volume_z', 1.2345)} (${pctile}번째 퍼센타일) — ${interpretation}.`;
}

describe('buildFearGreedFactorLines', () => {
    it('낮음 구간(<25)이면 "낮은 편"으로 해석하고 전체 문장을 그대로 생성한다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(10));

        expect(lines).toEqual([
            expectedLine(10, '최근 200영업일 분포 대비 낮은 편'),
        ]);
    });

    it('경계값 24는 여전히 낮음 구간이다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(24));

        expect(lines).toEqual([
            expectedLine(24, '최근 200영업일 분포 대비 낮은 편'),
        ]);
    });

    it('경계값 25는 낮음에서 평균 범위로 넘어간다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(25));

        expect(lines).toEqual([
            expectedLine(25, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('중간 구간(25~74)이면 "평균 범위 안"으로 해석한다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(50));

        expect(lines).toEqual([
            expectedLine(50, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('경계값 74는 여전히 평균 범위다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(74));

        expect(lines).toEqual([
            expectedLine(74, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('경계값 75는 평균 범위에서 높음으로 넘어간다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(75));

        expect(lines).toEqual([
            expectedLine(75, '최근 200영업일 분포 대비 높은 편'),
        ]);
    });

    it('높음 구간(>=75)이면 "높은 편"으로 해석하고 전체 문장을 그대로 생성한다', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(90));

        expect(lines).toEqual([
            expectedLine(90, '최근 200영업일 분포 대비 높은 편'),
        ]);
    });

    it('percentile은 반올림 후 구간을 판정한다(83.6 → 84th, 높음 구간)', () => {
        const lines = buildFearGreedFactorLines(buildSnapshot(83.6));

        expect(lines).toEqual([
            expectedLine(84, '최근 200영업일 분포 대비 높은 편'),
        ]);
    });

    it('groups 원 순서(Flow → Trend)를 그대로 따라 여러 factor를 flatMap한다', () => {
        const snapshot: FearGreedSnapshot = {
            score: 50,
            label: 'NEUTRAL',
            groups: [
                {
                    name: 'Flow',
                    score: 50,
                    factors: [
                        { key: 'volume_z', rawValue: 1.2, percentile: 10 },
                        {
                            key: 'buysell_imbalance',
                            rawValue: 0.12,
                            percentile: 50,
                        },
                    ],
                },
                {
                    name: 'Trend',
                    score: 50,
                    factors: [
                        {
                            key: 'ma200_distance',
                            rawValue: 0.05,
                            percentile: 90,
                        },
                    ],
                },
            ],
            confidence: 'normal',
            sampleSize: 220,
            warning: null,
        };

        const lines = buildFearGreedFactorLines(snapshot);

        expect(lines).toHaveLength(3);
        expect(lines[0]).toContain(FACTOR_LABEL.volume_z);
        expect(lines[1]).toContain(FACTOR_LABEL.buysell_imbalance);
        expect(lines[2]).toContain(FACTOR_LABEL.ma200_distance);
    });
});

// FIX 6 (audit, option b): the per-symbol raw values already exist
// (group scores, factor ranking) but weren't surfaced — this thin-content
// shape (~45 unique chars vs ~270 boilerplate per line) mirrors the shape
// that triggered the 2026-07 ranking collapse. These two functions add
// genuinely per-symbol narrative sentences built from those existing numbers.
function buildFlowTrendSnapshot(
    flowScore: number,
    trendScore: number
): FearGreedSnapshot {
    return {
        score: (flowScore + trendScore) / 2,
        label: 'NEUTRAL',
        groups: [
            {
                name: 'Flow',
                score: flowScore,
                factors: [
                    { key: 'volume_z', rawValue: 1.2, percentile: flowScore },
                ],
            },
            {
                name: 'Trend',
                score: trendScore,
                factors: [
                    {
                        key: 'ma200_distance',
                        rawValue: 0.05,
                        percentile: trendScore,
                    },
                ],
            },
        ],
        confidence: 'normal',
        sampleSize: 220,
        warning: null,
    };
}

describe('buildFearGreedGroupComparisonLine', () => {
    it('Flow 그룹 점수가 더 높으면 Flow 우위 문장을 생성한다', () => {
        const line = buildFearGreedGroupComparisonLine(
            buildFlowTrendSnapshot(70, 40)
        );
        expect(line).toBe(
            '수급 그룹 점수(70점)가 추세 그룹(40점)보다 30점 높아 수급 우위 흐름입니다.'
        );
    });

    it('Trend 그룹 점수가 더 높으면 Trend 우위 문장을 생성한다', () => {
        const line = buildFearGreedGroupComparisonLine(
            buildFlowTrendSnapshot(35, 80)
        );
        expect(line).toBe(
            '추세 그룹 점수(80점)가 수급 그룹(35점)보다 45점 높아 추세 우위 흐름입니다.'
        );
    });

    it('두 그룹 점수가 같으면 균형 문장을 생성한다', () => {
        const line = buildFearGreedGroupComparisonLine(
            buildFlowTrendSnapshot(55, 55)
        );
        expect(line).toBe(
            '수급 그룹과 추세 그룹이 모두 55점으로 균형 잡힌 흐름을 보이고 있습니다.'
        );
    });

    it('Flow/Trend 그룹 중 하나라도 없으면 null을 반환한다', () => {
        const snapshot: FearGreedSnapshot = {
            score: 50,
            label: 'NEUTRAL',
            groups: [
                {
                    name: 'Flow',
                    score: 50,
                    factors: [
                        { key: 'volume_z', rawValue: 1.2, percentile: 50 },
                    ],
                },
            ],
            confidence: 'normal',
            sampleSize: 220,
            warning: null,
        };
        expect(buildFearGreedGroupComparisonLine(snapshot)).toBeNull();
    });
});

describe('buildFearGreedFactorRankingLine', () => {
    it('50에서 가장 멀리 떨어진(가장 두드러진) factor를 지목한다 — 고percentile', () => {
        const snapshot = buildFlowTrendSnapshot(52, 92);
        const line = buildFearGreedFactorRankingLine(snapshot);
        expect(line).toBe(
            `2개 지표 중 가장 두드러진 지표는 ${FACTOR_LABEL.ma200_distance}로, 92번째 퍼센타일을 기록해 평소보다 높게 나타나고 있습니다.`
        );
    });

    it('50에서 가장 멀리 떨어진(가장 두드러진) factor를 지목한다 — 저percentile', () => {
        const snapshot = buildFlowTrendSnapshot(8, 48);
        const line = buildFearGreedFactorRankingLine(snapshot);
        expect(line).toBe(
            `2개 지표 중 가장 두드러진 지표는 ${FACTOR_LABEL.volume_z}로, 8번째 퍼센타일을 기록해 평소보다 낮게 나타나고 있습니다.`
        );
    });

    it('factor가 하나도 없으면 null을 반환한다', () => {
        const snapshot: FearGreedSnapshot = {
            score: 50,
            label: 'NEUTRAL',
            groups: [],
            confidence: 'normal',
            sampleSize: 220,
            warning: null,
        };
        expect(buildFearGreedFactorRankingLine(snapshot)).toBeNull();
    });
});

describe('FIX 6 — 두 심볼의 서로 다른 입력이 실질적으로 다른 텍스트를 만든다', () => {
    it('Flow 우위 심볼과 Trend 우위 심볼의 그룹 비교/랭킹 문장이 숫자 치환을 넘어 구조적으로 다르다', () => {
        const flowLeadSnapshot = buildFlowTrendSnapshot(85, 45);
        const trendLeadSnapshot = buildFlowTrendSnapshot(45, 85);

        const flowComparison =
            buildFearGreedGroupComparisonLine(flowLeadSnapshot);
        const trendComparison =
            buildFearGreedGroupComparisonLine(trendLeadSnapshot);
        expect(flowComparison).not.toBe(trendComparison);
        expect(flowComparison).toContain('수급 우위');
        expect(trendComparison).toContain('추세 우위');

        const flowRanking = buildFearGreedFactorRankingLine(flowLeadSnapshot);
        const trendRanking = buildFearGreedFactorRankingLine(trendLeadSnapshot);
        expect(flowRanking).not.toBe(trendRanking);
        expect(flowRanking).toContain(FACTOR_LABEL.volume_z);
        expect(trendRanking).toContain(FACTOR_LABEL.ma200_distance);
    });
});
