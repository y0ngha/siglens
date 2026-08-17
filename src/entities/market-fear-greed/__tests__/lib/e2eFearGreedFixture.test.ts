import { describe, expect, it } from 'vitest';

import { e2eDailyCloses } from '../../lib/e2eFearGreedFixture';

describe('e2eDailyCloses', () => {
    it('produces enough sessions for a normal-confidence snapshot', () => {
        // 웜업 125 + NORMAL 표본 60 = 185. 여유를 두고 그보다 훨씬 길어야 한다.
        expect(e2eDailyCloses('SPY').length).toBeGreaterThan(185);
    });

    it('is deterministic for a given symbol', () => {
        expect(e2eDailyCloses('SPY')).toEqual(e2eDailyCloses('SPY'));
    });

    it('gives different symbols different series', () => {
        const spy = e2eDailyCloses('SPY').map(p => p.close);
        const vix = e2eDailyCloses('^VIX').map(p => p.close);

        expect(spy).not.toEqual(vix);
    });

    it('emits ascending ISO dates shared across symbols so the inner join keeps every session', () => {
        const spy = e2eDailyCloses('SPY');
        const vix = e2eDailyCloses('^VIX');

        expect(spy.map(p => p.date)).toEqual(vix.map(p => p.date));
        expect(spy.every(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
        expect(spy.map(p => p.date)).toEqual(spy.map(p => p.date).sort());
    });

    it('keeps every close finite and positive', () => {
        expect(
            e2eDailyCloses('HYG').every(
                p => Number.isFinite(p.close) && p.close > 0
            )
        ).toBe(true);
    });
});
