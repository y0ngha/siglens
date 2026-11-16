import { describe, expect, it } from 'vitest';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { ResolvedNextEarnings } from '@/entities/analyst-views/lib/resolveNextEarnings';
import { applyResolvedNextEarnings } from '@/entities/earnings-report/lib/applyResolvedNextEarnings';

const ITEM: EarningsCalendarItem = {
    symbol: 'NVDA',
    earningsDate: '2026-11-20',
    epsActual: null,
    epsEstimated: 1.25,
    revenueActual: null,
    revenueEstimated: 54_000_000_000,
    lastUpdated: '2026-11-10',
};

function resolved(over: Partial<ResolvedNextEarnings>): ResolvedNextEarnings {
    return {
        date: '2026-11-20',
        confirmed: null,
        session: null,
        callAt: null,
        alt: null,
        ...over,
    };
}

describe('applyResolvedNextEarnings', () => {
    it('Yahoo 확정일로 날짜를 바꾸고, 확정이면 dateConfirmed 필드를 싣지 않는다', () => {
        const out = applyResolvedNextEarnings(
            ITEM,
            resolved({ date: '2026-11-19', confirmed: true })
        );
        expect(out).toEqual({ ...ITEM, earningsDate: '2026-11-19' });
        expect(out).not.toHaveProperty('dateConfirmed');
    });

    it('추정일이면 dateConfirmed:false를 싣는다', () => {
        expect(
            applyResolvedNextEarnings(ITEM, resolved({ confirmed: false }))
        ).toEqual({ ...ITEM, dateConfirmed: false });
    });

    it('모름(null)이면 원래 행 그대로이고 원래 행의 dateConfirmed:false도 대조 결과를 따른다', () => {
        expect(applyResolvedNextEarnings(ITEM, resolved({}))).toEqual(ITEM);
        expect(
            applyResolvedNextEarnings(
                { ...ITEM, dateConfirmed: false },
                resolved({ confirmed: false })
            )
        ).toEqual({ ...ITEM, dateConfirmed: false });
    });
});
