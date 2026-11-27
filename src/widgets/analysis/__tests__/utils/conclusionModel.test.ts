import type {
    ActionRecommendation,
    AnalysisResponse,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    PlanCheck,
} from '@y0ngha/siglens-core';
import { buildConclusionModel } from '@/widgets/analysis/utils/conclusionModel';
import {
    resolveLockedSections,
    type LockedSections,
} from '@/widgets/analysis/utils/lockedSections';

const UNLOCKED = resolveLockedSections([]);

function level(price: number): ClusteredKeyLevel {
    return { price, reason: 'r', count: 1, sources: [] };
}

function levels(
    support: readonly number[],
    resistance: readonly number[]
): ClusteredKeyLevels {
    return { support: support.map(level), resistance: resistance.map(level) };
}

function action(over: Partial<ActionRecommendation>): ActionRecommendation {
    return {
        positionAnalysis: '',
        entry: '',
        exit: '',
        riskReward: '',
        entryRecommendation: 'wait',
        entryPrices: [],
        stopLoss: undefined,
        takeProfitPrices: [],
        ...over,
    } as ActionRecommendation;
}

function planCheck(belowStopLoss: boolean): PlanCheck {
    return {
        currentPrice: 100,
        entryZoneTop: null,
        exceedsEntryZone: false,
        belowStopLoss,
        riskRewardAtEntry: null,
        riskRewardAtCurrent: null,
    };
}

function analysisOf(over: Record<string, unknown>): AnalysisResponse {
    return { trend: 'bullish', ...over } as unknown as AnalysisResponse;
}

function build(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels,
    locked: LockedSections = UNLOCKED
) {
    return buildConclusionModel({ analysis, keyLevels, locked });
}

describe('buildConclusionModel', () => {
    describe('trend', () => {
        it.each(['bullish', 'bearish', 'neutral'] as const)(
            '%s는 그대로 담는다',
            trend => {
                expect(build(analysisOf({ trend }), levels([], [])).trend).toBe(
                    trend
                );
            }
        );

        it('알 수 없는 문자열이면 null이다', () => {
            expect(
                build(analysisOf({ trend: 'sideways' }), levels([], [])).trend
            ).toBeNull();
        });

        it('trend 필드가 없거나 문자열이 아니면 null이다', () => {
            expect(
                build(analysisOf({ trend: undefined }), levels([], [])).trend
            ).toBeNull();
            expect(
                build(analysisOf({ trend: 3 }), levels([], [])).trend
            ).toBeNull();
        });

        it('Object.prototype 이름도 추세로 받아들이지 않는다', () => {
            expect(
                build(analysisOf({ trend: 'toString' }), levels([], [])).trend
            ).toBeNull();
        });
    });

    describe('저항선·지지선', () => {
        it('각 배열의 첫 값을 그대로 쓴다(다시 정렬하지 않는다)', () => {
            const model = build(
                analysisOf({}),
                levels([95, 90, 80], [105, 110])
            );
            expect(model.support).toEqual({ kind: 'price', price: 95 });
            expect(model.resistance).toEqual({ kind: 'price', price: 105 });
        });

        it('레벨이 하나뿐이어도 그 값이다', () => {
            const model = build(analysisOf({}), levels([95], [105]));
            expect(model.support).toEqual({ kind: 'price', price: 95 });
            expect(model.resistance).toEqual({ kind: 'price', price: 105 });
        });

        it('한쪽이 비어도 다른 쪽은 그대로 보인다', () => {
            const onlyResistance = build(analysisOf({}), levels([], [105]));
            expect(onlyResistance.support).toEqual({ kind: 'none' });
            expect(onlyResistance.resistance).toEqual({
                kind: 'price',
                price: 105,
            });

            const onlySupport = build(analysisOf({}), levels([95], []));
            expect(onlySupport.support).toEqual({ kind: 'price', price: 95 });
            expect(onlySupport.resistance).toEqual({ kind: 'none' });
        });

        it('둘 다 비면 없음이다', () => {
            const model = build(analysisOf({}), levels([], []));
            expect(model.support).toEqual({ kind: 'none' });
            expect(model.resistance).toEqual({ kind: 'none' });
        });

        it('배열이 빠진 부분 객체도 없음으로 다룬다', () => {
            const partial = {} as unknown as ClusteredKeyLevels;
            const model = build(analysisOf({}), partial);
            expect(model.support).toEqual({ kind: 'none' });
            expect(model.resistance).toEqual({ kind: 'none' });
        });

        it('partial_detail이 잠기면 레벨이 있어도 잠금이다', () => {
            const model = build(
                analysisOf({}),
                levels([95], [105]),
                resolveLockedSections(['partial_detail'])
            );
            expect(model.support).toEqual({ kind: 'locked' });
            expect(model.resistance).toEqual({ kind: 'locked' });
        });

        it('매매 전략 잠금은 레벨 행을 잠그지 않는다', () => {
            const model = build(
                analysisOf({}),
                levels([95], [105]),
                resolveLockedSections(['stoploss'])
            );
            expect(model.support).toEqual({ kind: 'price', price: 95 });
            expect(model.resistance).toEqual({ kind: 'price', price: 105 });
        });
    });

    describe('무효화 기준', () => {
        it('손절이 있으면 가격이다', () => {
            const model = build(
                analysisOf({ actionRecommendation: action({ stopLoss: 90 }) }),
                levels([], [])
            );
            expect(model.invalidation).toEqual({ kind: 'price', price: 90 });
        });

        it('보정값이 있으면 AI 원본보다 우선한다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        stopLoss: 120,
                        reconciledLevels: {
                            stopLoss: 90,
                            exit: '',
                            riskReward: '',
                            reason: '',
                        },
                    }),
                }),
                levels([], [])
            );
            expect(model.invalidation).toEqual({ kind: 'price', price: 90 });
        });

        it('보정값에 손절이 없으면 AI 원본을 쓴다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        stopLoss: 88,
                        reconciledLevels: {
                            exit: '',
                            riskReward: '',
                            reason: '',
                        },
                    }),
                }),
                levels([], [])
            );
            expect(model.invalidation).toEqual({ kind: 'price', price: 88 });
        });

        it.each([0, Number.NaN, -5, Number.POSITIVE_INFINITY])(
            '손절이 %s이면 없음이다',
            stopLoss => {
                const model = build(
                    analysisOf({ actionRecommendation: action({ stopLoss }) }),
                    levels([], [])
                );
                expect(model.invalidation).toEqual({ kind: 'none' });
            }
        );

        it('손절이 아예 없으면 없음이다', () => {
            const model = build(
                analysisOf({ actionRecommendation: action({}) }),
                levels([], [])
            );
            expect(model.invalidation).toEqual({ kind: 'none' });
        });

        it('actionRecommendation 자체가 없어도 없음이다', () => {
            const model = build(analysisOf({}), levels([], []));
            expect(model.invalidation).toEqual({ kind: 'none' });
        });

        it.each(['entry', 'stoploss', 'target', 'full_detail'] as const)(
            '%s가 잠기면 잠금이다',
            depth => {
                const model = build(
                    analysisOf({
                        actionRecommendation: action({ stopLoss: 90 }),
                    }),
                    levels([], []),
                    resolveLockedSections([depth])
                );
                expect(model.invalidation).toEqual({ kind: 'locked' });
            }
        );

        it('partial_detail만 잠기면 무효화 기준은 잠기지 않는다', () => {
            const model = build(
                analysisOf({ actionRecommendation: action({ stopLoss: 90 }) }),
                levels([95], [105]),
                resolveLockedSections(['partial_detail'])
            );
            expect(model.invalidation).toEqual({ kind: 'price', price: 90 });
        });
    });

    describe('isPlanVoid', () => {
        it('손절이 보이고 belowStopLoss가 참이면 참이다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        stopLoss: 90,
                        planCheck: planCheck(true),
                    }),
                }),
                levels([], [])
            );
            expect(model.isPlanVoid).toBe(true);
        });

        it('belowStopLoss가 거짓이면 거짓이다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        stopLoss: 90,
                        planCheck: planCheck(false),
                    }),
                }),
                levels([], [])
            );
            expect(model.isPlanVoid).toBe(false);
        });

        it('planCheck가 없으면 거짓이다', () => {
            const model = build(
                analysisOf({ actionRecommendation: action({ stopLoss: 90 }) }),
                levels([], [])
            );
            expect(model.isPlanVoid).toBe(false);
        });

        it('손절이 없으면 belowStopLoss가 참이어도 거짓이다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        planCheck: planCheck(true),
                    }),
                }),
                levels([], [])
            );
            expect(model.isPlanVoid).toBe(false);
        });

        it('무효화 기준이 잠겨 있으면 거짓이다', () => {
            const model = build(
                analysisOf({
                    actionRecommendation: action({
                        stopLoss: 90,
                        planCheck: planCheck(true),
                    }),
                }),
                levels([], []),
                resolveLockedSections(['stoploss'])
            );
            expect(model.isPlanVoid).toBe(false);
        });
    });
});
