import type { MarketDailyClose } from '@y0ngha/siglens-core';
import {
    REALIZED_VOL_WINDOW,
    toRealizedVolatilitySeries,
} from '../lib/realizedVolatility';

/** `n`일치 종가 시리즈 — `step(i)`가 i번째 종가를 준다. */
function series(n: number, step: (i: number) => number): MarketDailyClose[] {
    return Array.from({ length: n }, (_, i) => ({
        date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
        close: step(i),
    }));
}

describe('toRealizedVolatilitySeries', () => {
    it('returns nothing until the window is full', () => {
        // 창이 차기 전 값을 내보내면 표본이 20개가 안 되는 변동성이 섞인다.
        expect(
            toRealizedVolatilitySeries(series(REALIZED_VOL_WINDOW, () => 100))
        ).toEqual([]);
    });

    it('emits one point per session once the window is full', () => {
        // 수익률은 종가보다 1개 적고, 거기서 다시 창 크기만큼 소모된다.
        const closes = series(60, i => 100 + i);
        const out = toRealizedVolatilitySeries(closes);
        expect(out).toHaveLength(60 - 1 - REALIZED_VOL_WINDOW + 1);
    });

    it('dates each point at the last session of its window', () => {
        const closes = series(30, i => 100 + i);
        const out = toRealizedVolatilitySeries(closes);
        expect(out.at(-1)?.date).toBe(closes.at(-1)?.date);
    });

    it('reports (near) zero volatility for a perfectly flat series', () => {
        const out = toRealizedVolatilitySeries(series(40, () => 100));
        expect(out.at(-1)?.close).toBeCloseTo(0, 10);
    });

    it('reports a larger value for a noisier series', () => {
        // 요인이 보는 것은 절대 수준이 아니라 자기 과거 대비 위치지만, 방향은 맞아야 한다.
        const calm = toRealizedVolatilitySeries(
            series(60, i => 100 * (1 + (i % 2 === 0 ? 0.001 : -0.001)))
        );
        const wild = toRealizedVolatilitySeries(
            series(60, i => 100 * (1 + (i % 2 === 0 ? 0.05 : -0.05)))
        );
        expect(wild.at(-1)!.close).toBeGreaterThan(calm.at(-1)!.close);
    });

    it('annualizes to a VIX-like percentage scale', () => {
        // 일간 로그수익률이 ±1%로 번갈아 오면 표본표준편차 ≈ 1%,
        // 연율은 √252 × 1% ≈ 15.9%다. 백분율 표기(≈15.9)여야 로그에 찍혔을 때
        // 사람이 VIX와 같은 눈금으로 바로 읽는다.
        //
        // 누적합으로 종가를 만든다 — `exp(daily * i)`처럼 지수를 i에 비례시키면
        // 일간 수익률 자체가 i만큼 커져 축척 검증이 무의미해진다.
        const daily = 0.01;
        let logPrice = Math.log(100);
        const closes = series(60, i => {
            if (i > 0) logPrice += i % 2 === 0 ? daily : -daily;
            return Math.exp(logPrice);
        });

        const annualized = toRealizedVolatilitySeries(closes).at(-1)!.close;
        expect(annualized).toBeCloseTo(daily * Math.sqrt(252) * 100, 0);
    });

    it('sorts unsorted input before computing', () => {
        const ordered = series(40, i => 100 + i);
        const shuffled = [...ordered].reverse();
        expect(toRealizedVolatilitySeries(shuffled)).toEqual(
            toRealizedVolatilitySeries(ordered)
        );
    });

    it('skips non-positive closes instead of producing NaN', () => {
        // 분할·병합 같은 데이터 오류가 로그를 통해 NaN으로 전파되면 요인 전체가 죽는다.
        const closes = series(40, i => (i === 10 ? 0 : 100 + i));
        const out = toRealizedVolatilitySeries(closes);
        expect(out.length).toBeGreaterThan(0);
        expect(out.every(p => Number.isFinite(p.close))).toBe(true);
    });
});
