import { getTimeFormatter } from '@/domain/chart/timeFormat';

// 2024-03-30 09:30:00 UTC = 2024-03-30 18:30:00 KST (UTC+9)
const UTC_TIMESTAMP_SECONDS = 1711791000;

// 2024-03-29 15:00:00 UTC = 2024-03-30 00:00:00 KST (UTC+9, 다음날)
const MIDDAY_UTC_TIMESTAMP_SECONDS = 1711724400;

// 2024-01-15 17:00:00 UTC = 2024-01-16 02:00:00 KST (UTC+9, 다음날)
const LATE_UTC_TIMESTAMP_SECONDS =
    new Date('2024-01-15T17:00:00Z').getTime() / 1000;

describe('timeFormat', () => {
    describe('getTimeFormatter', () => {
        describe('5Min 타임프레임', () => {
            it('KST 기준 시:분 형식(HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('5Min');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
            });
        });

        describe('15Min 타임프레임', () => {
            it('KST 기준 시:분 형식(HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('15Min');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
            });
        });

        describe('30Min 타임프레임', () => {
            it('KST 기준 시:분 형식(HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('30Min');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
            });
        });

        describe('1Hour 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식을 반환한다', () => {
                const formatter = getTimeFormatter('1Hour');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('4Hour 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식을 반환한다', () => {
                const formatter = getTimeFormatter('4Hour');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('1Day 타임프레임', () => {
            it('KST 기준 월이름 일 형식(MMM D)을 반환한다', () => {
                const formatter = getTimeFormatter('1Day');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
            });
        });

        describe('날짜 경계 (UTC 기준 전날이지만 KST 기준 다음날)', () => {
            it('5Min: UTC 15:00은 KST 00:00 (다음날)으로 포맷된다', () => {
                const formatter = getTimeFormatter('5Min');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe('00:00');
            });

            it('30Min: UTC 15:00은 KST 00:00 (다음날)으로 포맷된다', () => {
                const formatter = getTimeFormatter('30Min');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe('00:00');
            });

            it('1Hour: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Hour');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('4Hour: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('4Hour');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('1Day: UTC 2024-03-29 15:00은 KST Mar 30으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Day');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
            });
        });

        describe('심야 시간 변환', () => {
            it('5Min: UTC 17:00은 KST 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('5Min');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe('02:00');
            });

            it('1Hour: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Hour');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });

            it('4Hour: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('4Hour');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });
        });

        describe('월 이름 경계', () => {
            it('1월은 Jan으로 표시된다', () => {
                const formatter = getTimeFormatter('1Day');
                // 2024-01-15 12:00:00 UTC = 2024-01-15 21:00:00 KST
                const janTimestamp =
                    new Date('2024-01-15T12:00:00Z').getTime() / 1000;
                expect(formatter(janTimestamp)).toBe('Jan 15');
            });

            it('12월은 Dec으로 표시된다', () => {
                const formatter = getTimeFormatter('1Day');
                // 2024-12-25 12:00:00 UTC = 2024-12-25 21:00:00 KST
                const decTimestamp =
                    new Date('2024-12-25T12:00:00Z').getTime() / 1000;
                expect(formatter(decTimestamp)).toBe('Dec 25');
            });
        });
    });
});
