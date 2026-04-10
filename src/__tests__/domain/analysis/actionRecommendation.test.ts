import { validateActionPrices } from '@/domain/analysis/actionRecommendation';
import type { ActionRecommendation } from '@/domain/types';

const makeRec = (
    overrides?: Partial<ActionRecommendation>
): ActionRecommendation => ({
    positionAnalysis: '현재 가격은 지지선 근처에 위치합니다.',
    entry: '165~167 구간에서 분할 매수를 고려하세요.',
    exit: '목표가 180, 손절가 160입니다.',
    riskReward: '손절 3% vs 목표 9% → 1:3',
    ...overrides,
});

describe('validateActionPrices', () => {
    describe('rec가 undefined일 때', () => {
        it('undefined를 반환한다', () => {
            expect(validateActionPrices(undefined)).toBeUndefined();
        });
    });

    describe('모든 가격 필드가 없을 때', () => {
        it('undefined를 반환한다', () => {
            const rec = makeRec({
                entryPrices: undefined,
                stopLoss: undefined,
                takeProfitPrices: undefined,
            });
            expect(validateActionPrices(rec)).toBeUndefined();
        });
    });

    describe('빈 배열만 있을 때', () => {
        it('undefined를 반환한다', () => {
            const rec = makeRec({
                entryPrices: [],
                stopLoss: undefined,
                takeProfitPrices: [],
            });
            expect(validateActionPrices(rec)).toBeUndefined();
        });
    });

    describe('유효하지 않은 가격만 있을 때', () => {
        it('0과 음수를 필터링하고 undefined를 반환한다', () => {
            const rec = makeRec({
                entryPrices: [0, -5],
                stopLoss: 0,
                takeProfitPrices: [-10],
            });
            expect(validateActionPrices(rec)).toBeUndefined();
        });
    });

    describe('유효한 entryPrices만 있을 때', () => {
        it('entryPrices를 포함한 결과를 반환한다', () => {
            const rec = makeRec({
                entryPrices: [165, 167],
                stopLoss: undefined,
                takeProfitPrices: undefined,
            });
            const result = validateActionPrices(rec);
            expect(result).not.toBeUndefined();
            expect(result?.entryPrices).toEqual([165, 167]);
            expect(result?.stopLoss).toBeUndefined();
            expect(result?.takeProfitPrices).toEqual([]);
        });
    });

    describe('유효한 stopLoss만 있을 때', () => {
        it('stopLoss를 포함한 결과를 반환한다', () => {
            const rec = makeRec({
                entryPrices: undefined,
                stopLoss: 160,
                takeProfitPrices: undefined,
            });
            const result = validateActionPrices(rec);
            expect(result).not.toBeUndefined();
            expect(result?.entryPrices).toEqual([]);
            expect(result?.stopLoss).toBe(160);
            expect(result?.takeProfitPrices).toEqual([]);
        });
    });

    describe('유효한 takeProfitPrices만 있을 때', () => {
        it('takeProfitPrices를 포함한 결과를 반환한다', () => {
            const rec = makeRec({
                entryPrices: undefined,
                stopLoss: undefined,
                takeProfitPrices: [180, 195],
            });
            const result = validateActionPrices(rec);
            expect(result).not.toBeUndefined();
            expect(result?.entryPrices).toEqual([]);
            expect(result?.stopLoss).toBeUndefined();
            expect(result?.takeProfitPrices).toEqual([180, 195]);
        });
    });

    describe('모든 가격 필드가 유효할 때', () => {
        it('모든 필드를 포함한 결과를 반환한다', () => {
            const rec = makeRec({
                entryPrices: [165, 167],
                stopLoss: 160,
                takeProfitPrices: [180, 195],
            });
            const result = validateActionPrices(rec);
            expect(result).toEqual({
                entryPrices: [165, 167],
                stopLoss: 160,
                takeProfitPrices: [180, 195],
            });
        });
    });

    describe('유효한 값과 유효하지 않은 값이 섞여 있을 때', () => {
        it('유효하지 않은 값(0, 음수)을 필터링한다', () => {
            const rec = makeRec({
                entryPrices: [0, 165, -1, 167],
                stopLoss: 160,
                takeProfitPrices: [-10, 180, 0, 195],
            });
            const result = validateActionPrices(rec);
            expect(result?.entryPrices).toEqual([165, 167]);
            expect(result?.stopLoss).toBe(160);
            expect(result?.takeProfitPrices).toEqual([180, 195]);
        });
    });
});
