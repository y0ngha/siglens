import { describe, it, expect } from 'vitest';
import { parseYahooDailyCloses } from '../../lib/parseYahooChartRows';

const D1 = new Date('2026-08-17T06:30:00.000Z');
const D2 = new Date('2026-08-18T06:30:00.000Z');

describe('parseYahooDailyCloses', () => {
    it('close를 KST 달력일 키로 매핑한다', () => {
        expect(
            parseYahooDailyCloses([
                { date: D1, close: 100 },
                { date: new Date('2026-08-17T21:00:00.000Z'), close: 101 },
            ])
        ).toEqual([
            { date: '2026-08-17', close: 100 },
            { date: '2026-08-18', close: 101 },
        ]);
    });

    it('모든 행이 adjclose를 가지면 시리즈 전체에 adjclose를 쓴다', () => {
        expect(
            parseYahooDailyCloses([
                { date: D1, close: 100, adjclose: 99 },
                { date: D2, close: 101, adjclose: 98 },
            ])
        ).toEqual([
            { date: '2026-08-17', close: 99 },
            { date: '2026-08-18', close: 98 },
        ]);
    });

    it('한 행이라도 adjclose가 빠지면 시리즈 전체를 close로 통일한다', () => {
        expect(
            parseYahooDailyCloses([
                { date: D1, close: 100, adjclose: 99 },
                { date: D2, close: 101, adjclose: null },
            ])
        ).toEqual([
            { date: '2026-08-17', close: 100 },
            { date: '2026-08-18', close: 101 },
        ]);
    });

    it('close가 없는 행의 adjclose 결손은 통일 판정에 영향을 주지 않는다', () => {
        expect(
            parseYahooDailyCloses([
                { date: D1, close: 100, adjclose: 99 },
                { date: D2, close: null },
            ])
        ).toEqual([{ date: '2026-08-17', close: 99 }]);
    });

    it('Date가 아닌 date 또는 쓸 수 없는 가격의 행은 버린다', () => {
        expect(
            parseYahooDailyCloses([
                { date: '2026-08-17', close: 100 },
                { date: D1, close: 0 },
                { date: D2, close: 5 },
            ])
        ).toEqual([{ date: '2026-08-18', close: 5 }]);
    });

    it.each([undefined, null, {}, 'x'])(
        '배열이 아닌 입력(%p)은 빈 배열이다',
        quotes => {
            expect(parseYahooDailyCloses(quotes)).toEqual([]);
        }
    );

    it('null 원소는 조용히 버리지 않고 던진다', () => {
        expect(() =>
            parseYahooDailyCloses([null, { date: D1, close: 1 }])
        ).toThrow(TypeError);
    });
});
