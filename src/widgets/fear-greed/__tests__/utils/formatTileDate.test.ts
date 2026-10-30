import { formatTileDate } from '../../utils/formatTileDate';

describe('formatTileDate', () => {
    it.each([
        ['ko', '2025년 3월 4일'],
        ['en', 'Mar 4, 2025'],
        ['ja', '2025年3月4日'],
        ['zh', '2025年3月4日'],
    ] as const)('%s 로케일 표기로 바꾼다', (locale, expected) => {
        expect(formatTileDate('2025-03-04', locale)).toBe(expected);
    });

    it('시간대와 무관하게 같은 날짜를 찍는다 (UTC 자정 기준)', () => {
        expect(formatTileDate('2025-01-01', 'en')).toBe('Jan 1, 2025');
    });
});
