import { describe, expect, it } from 'vitest';
import { foldDailyToMonthEnds } from '../foldMonthEnds';

describe('foldDailyToMonthEnds', () => {
    it('달마다 가장 늦은 거래일 종가 하나, 오래된 달 먼저(입력 순서 무관)', () => {
        expect(
            foldDailyToMonthEnds([
                { date: '2022-12-30', close: 3839.5 },
                { date: '2022-11-30', close: 4080.11 },
                { date: '2022-12-01', close: 4076.57 },
                { date: '2022-11-01', close: 3856.1 },
            ])
        ).toEqual([
            { month: '2022-11', close: 4080.11 },
            { month: '2022-12', close: 3839.5 },
        ]);
    });

    it('날짜 모양이 틀리거나 종가가 0 이하·비유한이면 버린다', () => {
        expect(
            foldDailyToMonthEnds([
                { date: '2022-12', close: 1 },
                { date: '2022-12-30', close: 0 },
                { date: '2022-12-29', close: Number.NaN },
                { date: '2022-12-28', close: 3783.22 },
            ])
        ).toEqual([{ month: '2022-12', close: 3783.22 }]);
    });
});
