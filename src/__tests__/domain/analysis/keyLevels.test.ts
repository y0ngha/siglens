import {
    validateKeyLevels,
    clusterKeyLevels,
    DEFAULT_EPSILON_PERCENT,
} from '@/domain/analysis/keyLevels';
import type { KeyLevels } from '@/domain/types';

describe('keyLevels', () => {
    describe('validateKeyLevels', () => {
        describe('유효한 데이터만 포함할 때', () => {
            it('모든 항목을 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [{ price: 100, reason: '지지선' }],
                    resistance: [{ price: 200, reason: '저항선' }],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '지지선' },
                ]);
                expect(result.resistance).toEqual([
                    { price: 200, reason: '저항선' },
                ]);
            });
        });

        describe('price가 0 이하인 항목이 있을 때', () => {
            it('price가 0인 지지선 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 0, reason: '유효하지 않음' },
                        { price: 100, reason: '유효' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '유효' },
                ]);
            });

            it('price가 음수인 저항선 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [
                        { price: -50, reason: '음수 가격' },
                        { price: 300, reason: '유효' },
                    ],
                };
                const result = validateKeyLevels(input);
                expect(result.resistance).toEqual([
                    { price: 300, reason: '유효' },
                ]);
            });
        });

        describe('배열 내 null/undefined 요소가 있을 때', () => {
            it('support 배열 내 null 요소를 필터링한다', () => {
                const input = {
                    support: [null, { price: 100, reason: '유효' }],
                    resistance: [],
                } as unknown as KeyLevels;
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '유효' },
                ]);
            });

            it('resistance 배열 내 undefined 요소를 필터링한다', () => {
                const input = {
                    support: [],
                    resistance: [
                        undefined,
                        { price: 200, reason: '유효' },
                        null,
                    ],
                } as unknown as KeyLevels;
                const result = validateKeyLevels(input);
                expect(result.resistance).toEqual([
                    { price: 200, reason: '유효' },
                ]);
            });
        });

        describe('reason이 빈 문자열인 항목이 있을 때', () => {
            it('reason이 빈 문자열인 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '' },
                        { price: 150, reason: '유효한 사유' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 150, reason: '유효한 사유' },
                ]);
            });

            it('reason이 공백만 있는 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '   ' },
                        { price: 200, reason: '유효' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 200, reason: '유효' },
                ]);
            });
        });

        describe('poc 필드 처리', () => {
            it('유효한 poc는 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 150, reason: 'PoC' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toEqual({ price: 150, reason: 'PoC' });
            });

            it('price가 0인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 0, reason: '유효하지 않음' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('reason이 빈 문자열인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 100, reason: '' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('poc가 undefined이면 결과도 undefined이다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('price가 0이고 reason이 빈 문자열인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 0, reason: '' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });
        });

        describe('빈 배열 입력일 때', () => {
            it('빈 support/resistance 배열을 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([]);
                expect(result.resistance).toEqual([]);
            });
        });

        describe('혼합 데이터일 때', () => {
            it('유효한 항목만 남기고 나머지를 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '유효' },
                        { price: 0, reason: '가격 무효' },
                        { price: 120, reason: '  ' },
                        { price: 80, reason: '유효 2' },
                    ],
                    resistance: [
                        { price: -10, reason: '음수' },
                        { price: 200, reason: '유효 저항' },
                        { price: 250, reason: '' },
                    ],
                    poc: { price: 150, reason: 'PoC 유효' },
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '유효' },
                    { price: 80, reason: '유효 2' },
                ]);
                expect(result.resistance).toEqual([
                    { price: 200, reason: '유효 저항' },
                ]);
                expect(result.poc).toEqual({ price: 150, reason: 'PoC 유효' });
            });
        });
    });

    describe('clusterKeyLevels', () => {
        const currentPrice = 100;
        const epsilonPercent = DEFAULT_EPSILON_PERCENT;

        describe('빈 배열일 때', () => {
            it('빈 배열을 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toEqual([]);
                expect(result.resistance).toEqual([]);
            });
        });

        describe('단독 레벨일 때', () => {
            it('count=1, sources에 원본을 포함한다', () => {
                const input: KeyLevels = {
                    support: [{ price: 95, reason: '지지선' }],
                    resistance: [],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toEqual([
                    {
                        price: 95,
                        reason: '지지선',
                        count: 1,
                        sources: [{ price: 95, reason: '지지선' }],
                    },
                ]);
            });
        });

        describe('2개 레벨이 epsilon 이내일 때', () => {
            it('하나의 클러스터로 병합하고 평균 가격을 반환한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100.2, reason: 'MA20' },
                        { price: 100.0, reason: 'EMA20' },
                    ],
                    resistance: [],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toHaveLength(1);
                expect(result.support[0].count).toBe(2);
                expect(result.support[0].price).toBeCloseTo(100.1);
                expect(result.support[0].reason).toBe('2개 지표 수렴');
                expect(result.support[0].sources).toHaveLength(2);
            });
        });

        describe('3개 이상 연쇄 클러스터링', () => {
            it('인접한 레벨들을 하나의 클러스터로 묶는다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100.0, reason: 'A' },
                        { price: 100.3, reason: 'B' },
                        { price: 100.5, reason: 'C' },
                    ],
                    resistance: [],
                };
                // epsilon = 0.5, gaps: 0.3 ≤ 0.5, 0.2 ≤ 0.5
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toHaveLength(1);
                expect(result.support[0].count).toBe(3);
                // (100.0 + 100.3 + 100.5) / 3 ≈ 100.267 → 반올림 100.27
                expect(result.support[0].price).toBeCloseTo(100.27);
                expect(result.support[0].reason).toBe('3개 지표 수렴');
            });
        });

        describe('epsilon 초과 gap이 있을 때', () => {
            it('별도 클러스터로 분리한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100.0, reason: 'A' },
                        { price: 100.3, reason: 'B' },
                        { price: 101.5, reason: 'C' },
                    ],
                    resistance: [],
                };
                // epsilon = 0.5, gaps: 0.3 ≤ 0.5, 1.2 > 0.5
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                // 내림차순: 높은 가격 클러스터가 먼저
                expect(result.support).toHaveLength(2);
                expect(result.support[0].count).toBe(1);
                expect(result.support[0].reason).toBe('C');
                expect(result.support[1].count).toBe(2);
            });
        });

        describe('POC 처리', () => {
            it('poc는 변경 없이 그대로 통과한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 150, reason: 'PoC' },
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.poc).toEqual({ price: 150, reason: 'PoC' });
            });

            it('poc가 undefined이면 결과도 undefined이다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.poc).toBeUndefined();
            });
        });

        describe('support와 resistance 독립 처리', () => {
            it('각각 별도로 클러스터링한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 95.0, reason: 'S1' },
                        { price: 95.3, reason: 'S2' },
                    ],
                    resistance: [
                        { price: 105.0, reason: 'R1' },
                        { price: 105.2, reason: 'R2' },
                    ],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toHaveLength(1);
                expect(result.support[0].count).toBe(2);
                expect(result.resistance).toHaveLength(1);
                expect(result.resistance[0].count).toBe(2);
            });
        });

        describe('입력 순서와 관계없이 정렬 후 클러스터링', () => {
            it('역순으로 입력해도 동일한 결과를 반환한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100.5, reason: 'C' },
                        { price: 100.0, reason: 'A' },
                        { price: 100.3, reason: 'B' },
                    ],
                    resistance: [],
                };
                const result = clusterKeyLevels(
                    input,
                    currentPrice,
                    epsilonPercent
                );
                expect(result.support).toHaveLength(1);
                expect(result.support[0].count).toBe(3);
                expect(result.support[0].sources).toEqual([
                    { price: 100.0, reason: 'A' },
                    { price: 100.3, reason: 'B' },
                    { price: 100.5, reason: 'C' },
                ]);
            });
        });

        describe('currentPrice가 0일 때', () => {
            it('epsilon이 0이므로 동일 가격만 병합한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100.0, reason: 'A' },
                        { price: 100.3, reason: 'B' },
                        { price: 100.0, reason: 'C' },
                    ],
                    resistance: [],
                };
                // 내림차순: 높은 가격이 먼저
                const result = clusterKeyLevels(input, 0);
                expect(result.support).toHaveLength(2);
                expect(result.support[0].count).toBe(1);
                expect(result.support[0].price).toBe(100.3);
                expect(result.support[1].count).toBe(2);
                expect(result.support[1].price).toBe(100.0);
            });
        });
    });
});
