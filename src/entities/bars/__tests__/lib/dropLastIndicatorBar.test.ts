import { describe, expect, it } from 'vitest';
import type { IndicatorResult } from '@y0ngha/siglens-core';
import { dropLastIndicatorBar } from '../../lib/dropLastIndicatorBar';

function drop(input: Record<string, unknown>): Record<string, unknown> {
    return dropLastIndicatorBar(
        input as unknown as IndicatorResult
    ) as unknown as Record<string, unknown>;
}

describe('dropLastIndicatorBar', () => {
    it('평면 배열은 마지막 원소를 뗀다', () => {
        expect(drop({ rsi: [1, 2, null] }).rsi).toEqual([1, 2]);
    });

    it('객체 배열도 마지막 원소를 뗀다', () => {
        expect(
            drop({ macd: [{ histogram: 1 }, { histogram: 2 }] }).macd
        ).toEqual([{ histogram: 1 }]);
    });

    it('값이 전부 배열인 Record(ma/ema)는 각 배열의 마지막 원소를 뗀다', () => {
        expect(drop({ ma: { 20: [1, 2, 3], 50: [4, 5, 6] } }).ma).toEqual({
            20: [1, 2],
            50: [4, 5],
        });
    });

    it('배열이 아닌 값이 섞인 스냅샷 객체는 그대로 둔다', () => {
        const smc = { swingHighs: [1, 2], premiumZone: { high: 2, low: 1 } };
        expect(drop({ smc }).smc).toBe(smc);
    });

    it('null 스냅샷과 빈 Record는 그대로 둔다', () => {
        const result = drop({ volumeProfile: null, ma: {} });
        expect(result.volumeProfile).toBeNull();
        expect(result.ma).toEqual({});
    });

    it('입력을 변경하지 않는다', () => {
        const rsi = [1, 2, 3];
        drop({ rsi });
        expect(rsi).toEqual([1, 2, 3]);
    });
});
