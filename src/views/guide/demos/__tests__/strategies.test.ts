import { describe, expect, it } from 'vitest';
import { STRATEGY_DEMOS } from '@/views/guide/demos/strategies';

const LOOKBACK = 20;
const FRESHNESS = 5;
const PIVOT_WINDOW = 2;

/** core의 다이버전스 후보 규칙(최근 20봉 피벗 저점 둘, 마지막 5봉 안)을 그대로 옮긴 검사. */
function pivotLows(lows: readonly number[]): number[] {
    return lows.flatMap((value, i) => {
        if (i < PIVOT_WINDOW || i >= lows.length - PIVOT_WINDOW) return [];
        const isPivot = [1, 2].every(
            k => value < lows[i - k] && value < lows[i + k]
        );
        return isPivot ? [i] : [];
    });
}

describe('strategy demos', () => {
    it('divergence: both lows sit in the core divergence window with a higher RSI low', () => {
        const demo = STRATEGY_DEMOS.divergence();
        const last = demo.bars.length - 1;
        const windowStart = demo.bars.length - LOOKBACK;
        const local = pivotLows(demo.bars.slice(windowStart).map(b => b.low));
        const pivots = local.map(i => i + windowStart);
        const [p1, p2] = pivots.slice(-2);
        expect(pivots.length).toBeGreaterThanOrEqual(2);
        expect(last - p2).toBeLessThanOrEqual(FRESHNESS);
        expect(demo.bars[p2].low).toBeLessThan(demo.bars[p1].low);
        const rsi = demo.panes?.[0].lines?.[0].values ?? [];
        expect(rsi[p2] ?? 0).toBeGreaterThan(rsi[p1] ?? Infinity);
        const line = (demo.overlays ?? []).find(o => o.kind === 'line');
        expect(line?.kind === 'line' && [line.from.i, line.to.i]).toEqual([
            p1,
            p2,
        ]);
    });

    it('mean-reversion: the 14-day low level spans 14 bars and MA200 counts toward the domain', () => {
        const demo = STRATEGY_DEMOS['mean-reversion']();
        const level = demo.overlays?.find(o => o.kind === 'level');
        const marker = demo.overlays?.find(
            o => o.kind === 'marker' && o.label === 'Near range low'
        );
        if (level?.kind !== 'level' || marker?.kind !== 'marker')
            throw new Error('missing overlays');
        expect(level.label).toBe('14-day low');
        expect(marker.i - (level.fromIndex ?? 0) + 1).toBe(14);
        const ma200 = demo.overlays?.find(
            o => o.kind === 'series' && o.label === 'MA200'
        );
        expect(ma200?.kind === 'series' && ma200.includeInDomain).toBe(true);
    });

    it('gap-analysis: the prior-bar high level starts at the bar before the gap', () => {
        const demo = STRATEGY_DEMOS['gap-analysis']();
        const level = demo.overlays?.find(o => o.kind === 'level');
        const zone = demo.overlays?.find(o => o.kind === 'zone');
        if (level?.kind !== 'level' || zone?.kind !== 'zone')
            throw new Error('missing overlays');
        expect(level.label).toBe('Prior bar high');
        expect(level.fromIndex).toBe(zone.fromIndex);
    });
});
