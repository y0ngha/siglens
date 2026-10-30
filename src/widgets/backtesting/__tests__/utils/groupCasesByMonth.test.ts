import type { BacktestCase } from '@y0ngha/siglens-core';
import {
    groupCasesByMonth,
    splitMonthKey,
} from '../../utils/groupCasesByMonth';

function makeCase(ticker: string, entryDate: string): BacktestCase {
    return { ticker, entryDate } as BacktestCase;
}

describe('splitMonthKey', () => {
    it('YYYY-MM 키를 연 문자열과 월 숫자로 쪼갠다', () => {
        expect(splitMonthKey('2024-06')).toEqual({ year: '2024', month: 6 });
        expect(splitMonthKey('2023-12')).toEqual({ year: '2023', month: 12 });
    });
});

describe('splitMonthKey — 형식 검증', () => {
    it.each(['2024', '2024-6', '2024-06-01', '', 'abcd-ef'])(
        '틀린 키 %j는 던진다',
        key => {
            expect(() => splitMonthKey(key)).toThrow('Invalid month key');
        }
    );
});

describe('groupCasesByMonth', () => {
    it('월을 최신순으로 묶고 월 안에서도 최신순이다', () => {
        const groups = groupCasesByMonth([
            makeCase('A', '2024-06-20'),
            makeCase('B', '2024-07-01'),
            makeCase('C', '2024-06-02'),
        ]);

        expect(groups.map(g => [g.key, g.items.map(c => c.ticker)])).toEqual([
            ['2024-07', ['B']],
            ['2024-06', ['A', 'C']],
        ]);
    });

    it('같은 진입일은 입력 순서를 지킨다', () => {
        const groups = groupCasesByMonth([
            makeCase('X', '2024-06-10'),
            makeCase('Y', '2024-06-10'),
        ]);

        expect(groups[0].items.map(c => c.ticker)).toEqual(['X', 'Y']);
    });

    it('월별 종목 건수를 첫 등장 순으로 센다', () => {
        const [group] = groupCasesByMonth([
            makeCase('AAPL', '2024-06-28'),
            makeCase('NVDA', '2024-06-20'),
            makeCase('AAPL', '2024-06-02'),
        ]);

        expect(Array.from(group.countByTicker)).toEqual([
            ['AAPL', 2],
            ['NVDA', 1],
        ]);
    });

    it('입력 배열을 변형하지 않는다', () => {
        const input = [
            makeCase('A', '2024-05-01'),
            makeCase('B', '2024-06-01'),
        ];
        groupCasesByMonth(input);

        expect(input.map(c => c.ticker)).toEqual(['A', 'B']);
    });

    it('빈 입력은 빈 목록이다', () => {
        expect(groupCasesByMonth([])).toEqual([]);
    });
});
