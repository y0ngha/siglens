import {
    dateConfirmedFromPayload,
    toCalendarItem,
} from '../../lib/earningsRowMapping';

describe('dateConfirmedFromPayload', () => {
    it.each([
        [{ isEstimate: true }, false],
        [{ isEstimate: false }, true],
        [{}, null],
        [{ isEstimate: 'yes' }, null],
        [null, null],
        ['x', null],
    ])('%j → %s', (payload, expected) => {
        expect(dateConfirmedFromPayload(payload)).toBe(expected);
    });
});

describe('toCalendarItem', () => {
    it('core 계약 필드만 남기고 확정 여부는 싣지 않는다', () => {
        const item = toCalendarItem({
            symbol: 'COP',
            earningsDate: '2026-11-05',
            epsActual: null,
            epsEstimated: 1.4,
            revenueActual: null,
            revenueEstimated: 1e10,
            lastUpdated: '2026-10-21',
            dateConfirmed: null,
        });
        expect(item).toEqual({
            symbol: 'COP',
            earningsDate: '2026-11-05',
            epsActual: null,
            epsEstimated: 1.4,
            revenueActual: null,
            revenueEstimated: 1e10,
            lastUpdated: '2026-10-21',
        });
        expect(item).not.toHaveProperty('dateConfirmed');
    });
});
