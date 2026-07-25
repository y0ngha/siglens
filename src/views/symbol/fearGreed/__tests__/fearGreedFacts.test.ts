import { describe, it, expect } from 'vitest';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { buildFearGreedFactorLines } from '../utils/fearGreedFacts';
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
    return `${FACTOR_LABEL.volume_z}: ${formatFactorRaw('volume_z', 1.2345)} (${pctile}th 퍼센타일) — ${interpretation}.`;
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
