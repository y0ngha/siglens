import { describe, it, expect, beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    buildFearGreedFactorLines,
    buildFearGreedGroupComparisonLine,
    buildFearGreedFactorRankingLine,
    buildFearGreedPeriodComparisonLine,
    buildFearGreedRegimeDistributionLine,
    buildFearGreedYearRangeLine,
    scoredHistory,
} from '../utils/fearGreedFacts';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

import koMessages from '@/../messages/ko.json';
import { formatFactorRaw } from '@/shared/lib/fearGreedLabels';

/**
 * 실제 ko 카탈로그를 읽는 번역자. `views.symbol.fearGreedFacts` 아래의 값을
 * 그대로 쓰고 `{v0}` 자리를 치환한다 — 키가 빠지면 키 문자열이 그대로 나와
 * 단언이 실패한다(스텁이면 조용히 통과한다).
 */
const lookup = (
    root: unknown,
    key: string,
    values?: Record<string, string | number>
) => {
    const raw = key
        .split('.')
        .reduce<unknown>(
            (node, seg) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[seg]
                    : undefined,
            root
        ) as string | undefined;
    if (raw === undefined) return key;
    return Object.entries(values ?? {}).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw
    );
};

const tFacts = (key: string, values?: Record<string, string | number>) =>
    lookup(koMessages.views.symbol.fearGreedFacts, key, values);

/** 팩터 라벨은 `shared.lib.fearGreedFactor`에 있다. */
const tFactor = (key: string, values?: Record<string, string | number>) =>
    lookup(koMessages.shared.lib.fearGreedFactor, key, values);

// t는 필수 인자다(§design EnumLabelTranslator required-param). ko로 고정한
// 실제 번역자를 한 번 만들어 모든 호출에 재사용한다.
let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

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
    return `${(koMessages.shared.lib.fearGreedFactor as unknown as { symbolLabel: Record<string, string> }).symbolLabel.volume_z}: ${formatFactorRaw('volume_z', 1.2345)} (${pctile}번째 퍼센타일) — ${interpretation}.`;
}

describe('buildFearGreedFactorLines', () => {
    it('낮음 구간(<25)이면 "낮은 편"으로 해석하고 전체 문장을 그대로 생성한다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(10),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(10, '최근 200영업일 분포 대비 낮은 편'),
        ]);
    });

    it('경계값 24는 여전히 낮음 구간이다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(24),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(24, '최근 200영업일 분포 대비 낮은 편'),
        ]);
    });

    it('경계값 25는 낮음에서 평균 범위로 넘어간다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(25),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(25, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('중간 구간(25~74)이면 "평균 범위 안"으로 해석한다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(50),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(50, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('경계값 74는 여전히 평균 범위다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(74),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(74, '최근 200영업일 분포의 평균 범위 안'),
        ]);
    });

    it('경계값 75는 평균 범위에서 높음으로 넘어간다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(75),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(75, '최근 200영업일 분포 대비 높은 편'),
        ]);
    });

    it('높음 구간(>=75)이면 "높은 편"으로 해석하고 전체 문장을 그대로 생성한다', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(90),
            tFacts,
            tFactor
        );

        expect(lines).toEqual([
            expectedLine(90, '최근 200영업일 분포 대비 높은 편'),
        ]);
    });

    it('percentile은 반올림 후 구간을 판정한다(83.6 → 84th, 높음 구간)', () => {
        const lines = buildFearGreedFactorLines(
            buildSnapshot(83.6),
            tFacts,
            tFactor
        );

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

        const lines = buildFearGreedFactorLines(snapshot, tFacts, tFactor);

        expect(lines).toHaveLength(3);
        expect(lines[0]).toContain(
            (
                koMessages.shared.lib.fearGreedFactor as unknown as {
                    symbolLabel: Record<string, string>;
                }
            ).symbolLabel.volume_z
        );
        expect(lines[1]).toContain(
            (
                koMessages.shared.lib.fearGreedFactor as unknown as {
                    symbolLabel: Record<string, string>;
                }
            ).symbolLabel.buysell_imbalance
        );
        expect(lines[2]).toContain(
            (
                koMessages.shared.lib.fearGreedFactor as unknown as {
                    symbolLabel: Record<string, string>;
                }
            ).symbolLabel.ma200_distance
        );
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
            buildFlowTrendSnapshot(70, 40),
            tFacts
        );
        expect(line).toBe(
            '수급 그룹 점수(70점)가 추세 그룹(40점)보다 30점 높아 수급 우위 흐름입니다.'
        );
    });

    it('Trend 그룹 점수가 더 높으면 Trend 우위 문장을 생성한다', () => {
        const line = buildFearGreedGroupComparisonLine(
            buildFlowTrendSnapshot(35, 80),
            tFacts
        );
        expect(line).toBe(
            '추세 그룹 점수(80점)가 수급 그룹(35점)보다 45점 높아 추세 우위 흐름입니다.'
        );
    });

    it('두 그룹 점수가 같으면 균형 문장을 생성한다', () => {
        const line = buildFearGreedGroupComparisonLine(
            buildFlowTrendSnapshot(55, 55),
            tFacts
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
        expect(buildFearGreedGroupComparisonLine(snapshot, tFacts)).toBeNull();
    });
});

describe('buildFearGreedFactorRankingLine', () => {
    it('50에서 가장 멀리 떨어진(가장 두드러진) factor를 지목한다 — 고percentile', () => {
        const snapshot = buildFlowTrendSnapshot(52, 92);
        const line = buildFearGreedFactorRankingLine(snapshot, tFacts, tFactor);
        expect(line).toBe(
            `2개 지표 중 가장 두드러진 지표는 ${(koMessages.shared.lib.fearGreedFactor as unknown as { symbolLabel: Record<string, string> }).symbolLabel.ma200_distance}로, 92번째 퍼센타일을 기록해 평소보다 높게 나타나고 있습니다.`
        );
    });

    it('50에서 가장 멀리 떨어진(가장 두드러진) factor를 지목한다 — 저percentile', () => {
        const snapshot = buildFlowTrendSnapshot(8, 48);
        const line = buildFearGreedFactorRankingLine(snapshot, tFacts, tFactor);
        expect(line).toBe(
            `2개 지표 중 가장 두드러진 지표는 ${(koMessages.shared.lib.fearGreedFactor as unknown as { symbolLabel: Record<string, string> }).symbolLabel.volume_z}로, 8번째 퍼센타일을 기록해 평소보다 낮게 나타나고 있습니다.`
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
        expect(
            buildFearGreedFactorRankingLine(snapshot, tFacts, tFactor)
        ).toBeNull();
    });
});

describe('FIX 6 — 두 심볼의 서로 다른 입력이 실질적으로 다른 텍스트를 만든다', () => {
    it('Flow 우위 심볼과 Trend 우위 심볼의 그룹 비교/랭킹 문장이 숫자 치환을 넘어 구조적으로 다르다', () => {
        const flowLeadSnapshot = buildFlowTrendSnapshot(85, 45);
        const trendLeadSnapshot = buildFlowTrendSnapshot(45, 85);

        const flowComparison = buildFearGreedGroupComparisonLine(
            flowLeadSnapshot,
            tFacts
        );
        const trendComparison = buildFearGreedGroupComparisonLine(
            trendLeadSnapshot,
            tFacts
        );
        expect(flowComparison).not.toBe(trendComparison);
        expect(flowComparison).toContain('수급 우위');
        expect(trendComparison).toContain('추세 우위');

        const flowRanking = buildFearGreedFactorRankingLine(
            flowLeadSnapshot,
            tFacts,
            tFactor
        );
        const trendRanking = buildFearGreedFactorRankingLine(
            trendLeadSnapshot,
            tFacts,
            tFactor
        );
        expect(flowRanking).not.toBe(trendRanking);
        expect(flowRanking).toContain(
            (
                koMessages.shared.lib.fearGreedFactor as unknown as {
                    symbolLabel: Record<string, string>;
                }
            ).symbolLabel.volume_z
        );
        expect(trendRanking).toContain(
            (
                koMessages.shared.lib.fearGreedFactor as unknown as {
                    symbolLabel: Record<string, string>;
                }
            ).symbolLabel.ma200_distance
        );
    });
});

describe('시계열 문장 (P1/P2/P5)', () => {
    /** `computeFearGreedHistory` 출력 형태를 그대로 흉내 낸 픽스처. */
    function history(
        scores: (number | null)[]
    ): { date: string; score: number | null; label: FearGreedLabel | null }[] {
        return scores.map((score, i) => ({
            // 2026-01-01부터 하루씩 — 실제 거래일 달력이 아니어도 문장 생성엔 무관.
            date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
            score,
            label: score === null ? null : labelOf(score),
        }));
    }

    function labelOf(score: number): FearGreedLabel {
        if (score < 25) return 'EXTREME_FEAR';
        if (score < 45) return 'FEAR';
        if (score < 55) return 'NEUTRAL';
        if (score < 75) return 'GREED';
        return 'EXTREME_GREED';
    }

    it('scoredHistory는 warm-up(null)을 걷어낸다', () => {
        const points = scoredHistory(history([null, null, 50, 60]));
        expect(points).toHaveLength(2);
        expect(points.map(p => p.score)).toEqual([50, 60]);
    });

    describe('buildFearGreedPeriodComparisonLine', () => {
        it('1주/1개월/1년 전을 모두 갖추면 셋 다 언급한다', () => {
            // 마지막이 현재. 인덱스 -6=1주전, -22=1개월전, -253=1년전.
            const scores = Array.from({ length: 260 }, () => 50);
            scores[260 - 1 - 5] = 61; // 1주 전
            scores[260 - 1 - 21] = 30; // 1개월 전
            scores[260 - 1 - 252] = 43; // 1년 전
            scores[259] = 43; // 현재
            const line = buildFearGreedPeriodComparisonLine(
                scoredHistory(history(scores)),
                t,
                tFacts
            )!;

            expect(line).toContain('현재 43점');
            expect(line).toContain('1주 전 61점');
            // 마지막 절이 아니면 연결어미.
            expect(line).toContain('18점 낮고');
            expect(line).toContain('1개월 전 30점');
            expect(line).toContain('13점 높고');
            // 1년 전이 현재와 같으면 크기 없이 '같습니다'만.
            // 마지막 절만 종결어미. 차이가 0이면 `대비`가 아니라 조사를 붙인다
            // (`대비 같고`는 비문). `공포`는 받침이 없어 `와`.
            expect(line).toContain('1년 전 43점(공포)와 같습니다.');
        });

        it('시계열이 짧으면 확보된 기간만 말한다', () => {
            const line = buildFearGreedPeriodComparisonLine(
                scoredHistory(history(Array.from({ length: 10 }, () => 50))),
                t,
                tFacts
            )!;
            expect(line).toContain('1주 전');
            expect(line).not.toContain('1개월 전');
            expect(line).not.toContain('1년 전');
        });

        it('비교 대상이 하나도 없으면 null', () => {
            expect(
                buildFearGreedPeriodComparisonLine(
                    scoredHistory(history([50])),
                    t,
                    tFacts
                )
            ).toBeNull();
        });
    });

    describe('buildFearGreedYearRangeLine', () => {
        it('최저·최고를 날짜와 함께, 현재 위치를 백분위로 말한다', () => {
            const scores = Array.from({ length: 100 }, (_, i) => 40 + (i % 20));
            scores[3] = 12; // 최저
            scores[70] = 88; // 최고
            scores[99] = 43; // 현재
            const line = buildFearGreedYearRangeLine(
                scoredHistory(history(scores)),
                tFacts
            )!;

            expect(line).toContain('최저 12점(2026년 1월 4일)');
            expect(line).toContain('최고 88점(2026년 3월 12일)');
            // 중앙값·백분위는 이 문장에서 **계산되는** 유일한 두 값이다. 정규식
            // `\d+`로 두면 `<=`를 `<`로 바꾸거나 분모를 n-1로 해도 통과한다.
            // 픽스처가 완전히 결정적이므로 정확한 값을 박는다.
            // scores = 40 + (i % 20), i=0..99, 단 [3]=12 [70]=88 [99]=43.
            expect(line).toContain('중앙값은 49점');
            expect(line).toContain(
                '현재 43점은 이 분포에서 21% 지점에 해당합니다'
            );
        });

        it('표본이 60개 미만이면 분포를 말하지 않는다', () => {
            expect(
                buildFearGreedYearRangeLine(
                    scoredHistory(
                        history(Array.from({ length: 59 }, () => 50))
                    ),
                    tFacts
                )
            ).toBeNull();
        });
    });

    describe('buildFearGreedRegimeDistributionLine', () => {
        it('라벨별 체류일과 비율을 말하고, 0일 구간은 뺀다', () => {
            // 60일: 공포 30 + 탐욕 30. 중립/극단은 0일이라 등장하면 안 된다.
            const scores = [
                ...Array.from({ length: 30 }, () => 30),
                ...Array.from({ length: 30 }, () => 65),
            ];
            const line = buildFearGreedRegimeDistributionLine(
                scoredHistory(history(scores)),
                t,
                tFacts
            )!;

            // 표본이 252거래일에 못 미치면 "최근 1년"이라고 쓰지 않는다.
            expect(line).toContain('최근 60거래일 중');
            expect(line).not.toContain('최근 1년');
            expect(line).toContain('공포 30일(50%)');
            expect(line).toContain('탐욕 30일(50%)');
            expect(line).not.toContain('중립');
            expect(line).not.toContain('극심한');
        });

        it('1% 미만으로 반올림되는 구간은 비율을 생략한다 (1일(0%) 방지)', () => {
            const scores = [
                10, // 극심한 공포 1일 → 1/201 = 0.5% → 0%로 반올림
                ...Array.from({ length: 200 }, () => 50),
            ];
            const line = buildFearGreedRegimeDistributionLine(
                scoredHistory(history(scores)),
                t,
                tFacts
            )!;

            expect(line).toContain('극심한 공포 1일,');
            expect(line).not.toContain('(0%)');
        });

        it('표본이 252거래일 이상이면 "최근 1년"이라고 쓴다', () => {
            const line = buildFearGreedRegimeDistributionLine(
                scoredHistory(history(Array.from({ length: 300 }, () => 50))),
                t,
                tFacts
            )!;

            // 300개를 넣어도 창은 마지막 252개다.
            expect(line).toContain('최근 1년 252거래일 중');
        });
    });
});
