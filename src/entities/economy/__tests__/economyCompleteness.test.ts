import { describe, it, expect } from 'vitest';
import { isEmptyEconomySnapshot } from '@/entities/economy/lib/economyCompleteness';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

const POINT = { date: '2026-05-01', value: 3.63 };

describe('isEmptyEconomySnapshot', () => {
    it('전 축 결측이면 true', () => {
        expect(
            isEmptyEconomySnapshot({
                indicators: [
                    { name: 'x', latest: null, previous: null, trend: [] },
                ],
                treasury: null,
                calendar: [],
            } satisfies EconomySnapshot)
        ).toBe(true);
    });

    it('지표 한 개라도 latest 있으면 false', () => {
        expect(
            isEmptyEconomySnapshot({
                indicators: [
                    { name: 'x', latest: null, previous: null, trend: [] },
                    {
                        name: 'y',
                        latest: POINT,
                        previous: null,
                        trend: [POINT],
                    },
                ],
                treasury: null,
                calendar: [],
            } satisfies EconomySnapshot)
        ).toBe(false);
    });

    it('treasury만 있어도 false', () => {
        expect(
            isEmptyEconomySnapshot({
                indicators: [],
                treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
                calendar: [],
            } satisfies EconomySnapshot)
        ).toBe(false);
    });

    it('calendar 이벤트가 있으면 false', () => {
        expect(
            isEmptyEconomySnapshot({
                indicators: [],
                treasury: null,
                calendar: [
                    {
                        date: '2026-06-17 14:00:00',
                        event: 'Fed Rate',
                        impact: 'High',
                        actual: null,
                        estimate: 3.63,
                        previous: 3.63,
                        unit: '%',
                    },
                ],
            } satisfies EconomySnapshot)
        ).toBe(false);
    });
});
