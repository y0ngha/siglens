import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { clampBarsRange, withConsistentRange } from '../barRange';

const bar = (o: number, h: number, l: number, c: number): Bar => ({
    time: 1728864000,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 1,
});

describe('withConsistentRange', () => {
    it('종가가 저가 아래면 저가를 종가로 넓힌다', () => {
        expect(withConsistentRange(bar(59500, 61200, 59400, 59300))).toEqual(
            bar(59500, 61200, 59300, 59300)
        );
    });

    it('종가가 고가 위면 고가를 종가로 넓힌다', () => {
        expect(
            withConsistentRange(bar(350000, 351000, 342500, 354500))
        ).toEqual(bar(350000, 354500, 342500, 354500));
    });

    it('시가가 범위 밖이어도 고저를 넓힌다', () => {
        expect(withConsistentRange(bar(95, 94, 92, 93))).toEqual(
            bar(95, 95, 92, 93)
        );
    });

    it('이미 일관된 봉은 같은 객체를 돌려준다', () => {
        const ok = bar(100, 105, 99, 102);
        expect(withConsistentRange(ok)).toBe(ok);
    });
});

describe('clampBarsRange', () => {
    it('고친 봉이 없으면 입력 배열을 그대로 돌려주고 fixed는 0이다', () => {
        const bars = [bar(100, 105, 99, 102)];
        const result = clampBarsRange(bars);
        expect(result.bars).toBe(bars);
        expect(result.fixed).toBe(0);
    });

    it('고친 봉 수를 센다', () => {
        const result = clampBarsRange([
            bar(100, 105, 99, 102),
            bar(59500, 61200, 59400, 59300),
            bar(350000, 351000, 342500, 354500),
        ]);
        expect(result.fixed).toBe(2);
        expect(result.bars[0]).toEqual(bar(100, 105, 99, 102));
    });

    it('깨끗한 입력은 복사 없이 같은 배열 참조를 돌려준다', () => {
        const bars = [bar(100, 105, 99, 102), bar(102, 106, 101, 105)];
        expect(clampBarsRange(bars).bars).toBe(bars);
    });

    it('첫 불일치 봉이 가운데에 있어도 앞뒤 봉은 그대로 두고 그 봉만 센다', () => {
        const first = bar(100, 105, 99, 102);
        const last = bar(102, 106, 101, 105);
        const input = [first, bar(59500, 61200, 59400, 59300), last];
        const result = clampBarsRange(input);
        expect(result.bars).not.toBe(input);
        expect(result.bars).toEqual([
            first,
            bar(59500, 61200, 59300, 59300),
            last,
        ]);
        expect(result.bars[0]).toBe(first);
        expect(result.bars[2]).toBe(last);
        expect(result.fixed).toBe(1);
        expect(input[1]).toEqual(bar(59500, 61200, 59400, 59300));
    });
});
