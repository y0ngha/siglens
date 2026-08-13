// @vitest-environment node
import type { IndicatorResult } from '@y0ngha/siglens-core';
import {
    INDICATOR_SIGNIFICANT_DIGITS,
    roundIndicators,
} from '../lib/roundIndicators';

/** `IndicatorResult`의 실제 필드 모양 4종(평면 배열 / 객체 배열 / Record-of-arrays / 스냅샷)을 대표하는 최소 픽스처. */
function makeIndicators(): IndicatorResult {
    return {
        rsi: [78.09897109260167, null, 58.77747837186217],
        macd: [
            {
                macd: 1.2345678901234567,
                signal: -0.9876543210987654,
                histogram: 0.1,
            },
        ],
        ma: { 20: [178.12345678901234, null], 60: [180.5] },
        obv: [1234567890, -987654321],
        volumeProfile: {
            poc: 178.98765432109876,
            vah: 180.11111111111,
            val: 176.99999999999,
            profile: [{ price: 1.111111111, volume: 100 }],
        },
    } as unknown as IndicatorResult;
}

describe('roundIndicators', () => {
    it('평면 배열의 실수를 유효숫자 6자리로 줄인다', () => {
        const out = roundIndicators(makeIndicators());
        expect(out.rsi).toEqual([78.099, null, 58.7775]);
    });

    it('객체 배열(macd)의 중첩 실수도 줄인다', () => {
        const out = roundIndicators(makeIndicators());
        expect(out.macd[0]).toEqual({
            macd: 1.23457,
            signal: -0.987654,
            histogram: 0.1,
        });
    });

    it('Record-of-arrays(ma/ema)의 키를 보존하며 줄인다', () => {
        const out = roundIndicators(makeIndicators());
        expect(Object.keys(out.ma)).toEqual(['20', '60']);
        expect(out.ma[20]).toEqual([178.123, null]);
        expect(out.ma[60]).toEqual([180.5]);
    });

    it('스냅샷 객체(volumeProfile)의 중첩까지 재귀한다', () => {
        const out = roundIndicators(makeIndicators());
        expect(out.volumeProfile?.poc).toBe(178.988);
        expect(out.volumeProfile?.vah).toBe(180.111);
        expect(out.volumeProfile?.profile[0]).toEqual({
            price: 1.11111,
            volume: 100,
        });
    });

    it('null을 보존한다 — 지표 워밍업 구간이 undefined로 바뀌면 차트가 끊긴다', () => {
        const out = roundIndicators(makeIndicators());
        expect(out.rsi[1]).toBeNull();
        expect(out.ma[20][1]).toBeNull();
    });

    it('정수는 그대로 둔다 (거래량·OBV는 반올림 대상이 아니다)', () => {
        const out = roundIndicators(makeIndicators());
        expect(out.obv).toEqual([1234567890, -987654321]);
    });

    it('필드 집합을 바꾸지 않는다 — 키 누락은 차트 훅에서 런타임 오류가 된다', () => {
        const input = makeIndicators();
        const out = roundIndicators(input);
        expect(Object.keys(out).sort()).toEqual(Object.keys(input).sort());
    });

    it('NaN·Infinity는 통과시킨다 (Math.round가 값 종류를 바꾸지 않도록)', () => {
        const out = roundIndicators({
            rsi: [Number.NaN, Number.POSITIVE_INFINITY],
        } as unknown as IndicatorResult);
        expect(Number.isNaN(out.rsi[0])).toBe(true);
        expect(out.rsi[1]).toBe(Number.POSITIVE_INFINITY);
    });

    it('직렬화 크기가 실제로 줄어든다 (이 변경의 존재 이유)', () => {
        const input = makeIndicators();
        const before = JSON.stringify(input).length;
        const after = JSON.stringify(roundIndicators(input)).length;
        expect(after).toBeLessThan(before);
    });

    it('유효숫자 자릿수를 초과하는 값이 남지 않는다', () => {
        const out = roundIndicators(makeIndicators());
        for (const v of out.rsi) {
            if (typeof v === 'number') {
                expect(v).toBe(
                    Number(v.toPrecision(INDICATOR_SIGNIFICANT_DIGITS))
                );
            }
        }
    });

    // 리뷰 라운드 1에서 잡힌 결함 2건의 회귀 테스트. 고정 소수 자릿수(round(v,4))로
    // 되돌리면 두 테스트 모두 깨진다.
    it('저가 크립토(SHIBUSD 가격대)를 0으로 뭉개지 않는다', () => {
        const out = roundIndicators({
            ma: { 20: [0.0000123456789, 0.00000891234] },
        } as unknown as IndicatorResult);
        expect(out.ma[20][0]).toBeCloseTo(0.0000123457, 12);
        expect(out.ma[20][0]).not.toBe(0);
        expect(out.ma[20][1]).not.toBe(0);
    });

    it('0 교차 구간의 MACD 히스토그램 부호를 보존한다', () => {
        // technicalFacts.ts가 `histogram > 0 / < 0`으로 모멘텀 라벨을 가른다 —
        // 0으로 뭉개지면 '상승'/'하락'이 '중립'으로 뒤집힌다.
        const out = roundIndicators({
            macd: [
                { macd: 0, signal: 0, histogram: 0.00003 },
                { macd: 0, signal: 0, histogram: -0.000047 },
            ],
        } as unknown as IndicatorResult);
        expect(out.macd[0].histogram).toBeGreaterThan(0);
        expect(out.macd[1].histogram).toBeLessThan(0);
    });
});
