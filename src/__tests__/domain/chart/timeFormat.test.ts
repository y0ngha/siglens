import { getTimeFormatter } from '@/domain/chart/timeFormat';

// 2024-03-30 09:30:00 UTC = 2024-03-30 18:30:00 KST
const UTC_TIMESTAMP_SECONDS = 1711791000;

// 2024-03-29 15:00:00 UTC = 2024-03-30 00:00:00 KST (자정 경계)
const MIDNIGHT_KST_TIMESTAMP_SECONDS = 1711724400;

describe('getTimeFormatter', () => {
    describe('1Min 타임프레임', () => {
        it('시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('1Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
        });
    });

    describe('5Min 타임프레임', () => {
        it('시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('5Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
        });
    });

    describe('15Min 타임프레임', () => {
        it('시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('15Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
        });
    });

    describe('1Hour 타임프레임', () => {
        it('월/일 시:분 형식을 반환한다', () => {
            const formatter = getTimeFormatter('1Hour');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
        });
    });

    describe('1Day 타임프레임', () => {
        it('월이름 일 형식(MMM D)을 반환한다', () => {
            const formatter = getTimeFormatter('1Day');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
        });
    });

    describe('UTC 자정 → KST 다음날 09:00 경계 케이스', () => {
        it('1Min: UTC 15:00은 KST 다음날 00:00으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Min');
            expect(formatter(MIDNIGHT_KST_TIMESTAMP_SECONDS)).toBe('00:00');
        });

        it('1Hour: UTC 15:00 자정 경계는 날짜+시간으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Hour');
            expect(formatter(MIDNIGHT_KST_TIMESTAMP_SECONDS)).toBe(
                '3/30 00:00'
            );
        });

        it('1Day: UTC 15:00 자정 경계는 날짜로 포맷된다', () => {
            const formatter = getTimeFormatter('1Day');
            expect(formatter(MIDNIGHT_KST_TIMESTAMP_SECONDS)).toBe('Mar 30');
        });
    });

    describe('월 이름 경계', () => {
        it('1월은 Jan으로 표시된다', () => {
            // 2024-01-15 00:00:00 UTC → KST 2024-01-15 09:00
            const formatter = getTimeFormatter('1Day');
            const janTimestamp =
                new Date('2024-01-15T00:00:00Z').getTime() / 1000;
            expect(formatter(janTimestamp)).toBe('Jan 15');
        });

        it('12월은 Dec으로 표시된다', () => {
            const formatter = getTimeFormatter('1Day');
            const decTimestamp =
                new Date('2024-12-25T00:00:00Z').getTime() / 1000;
            expect(formatter(decTimestamp)).toBe('Dec 25');
        });
    });
});
