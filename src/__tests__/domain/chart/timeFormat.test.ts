import { getTimeFormatter } from '@/domain/chart/timeFormat';

// 2024-03-30 09:30:00 UTC = 2024-03-30 05:30:00 EDT (UTC-4, DST active)
const UTC_TIMESTAMP_SECONDS = 1711791000;

// 2024-03-29 15:00:00 UTC = 2024-03-29 11:00:00 EDT (UTC-4, DST active)
const MIDDAY_ET_TIMESTAMP_SECONDS = 1711724400;

// 2024-01-15 17:00:00 UTC = 2024-01-15 12:00:00 EST (UTC-5, DST inactive)
const EST_TIMESTAMP_SECONDS = new Date('2024-01-15T17:00:00Z').getTime() / 1000;

describe('getTimeFormatter', () => {
    describe('1Min 타임프레임', () => {
        it('ET 기준 시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('1Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('05:30');
        });
    });

    describe('5Min 타임프레임', () => {
        it('ET 기준 시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('5Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('05:30');
        });
    });

    describe('15Min 타임프레임', () => {
        it('ET 기준 시:분 형식(HH:mm)을 반환한다', () => {
            const formatter = getTimeFormatter('15Min');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('05:30');
        });
    });

    describe('1Hour 타임프레임', () => {
        it('ET 기준 월/일 시:분 형식을 반환한다', () => {
            const formatter = getTimeFormatter('1Hour');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 05:30');
        });
    });

    describe('1Day 타임프레임', () => {
        it('ET 기준 월이름 일 형식(MMM D)을 반환한다', () => {
            const formatter = getTimeFormatter('1Day');
            expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
        });
    });

    describe('EDT → EST DST 경계 케이스', () => {
        it('1Min: EDT(UTC-4) 기간의 UTC 15:00은 ET 11:00으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Min');
            expect(formatter(MIDDAY_ET_TIMESTAMP_SECONDS)).toBe('11:00');
        });

        it('1Hour: EDT(UTC-4) 기간의 UTC 15:00은 날짜+시간으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Hour');
            expect(formatter(MIDDAY_ET_TIMESTAMP_SECONDS)).toBe('3/29 11:00');
        });

        it('1Day: EDT(UTC-4) 기간의 날짜는 ET 날짜로 포맷된다', () => {
            const formatter = getTimeFormatter('1Day');
            expect(formatter(MIDDAY_ET_TIMESTAMP_SECONDS)).toBe('Mar 29');
        });
    });

    describe('EST 기간 (DST 비활성)', () => {
        it('1Min: EST(UTC-5) 기간의 UTC 17:00은 ET 12:00으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Min');
            expect(formatter(EST_TIMESTAMP_SECONDS)).toBe('12:00');
        });

        it('1Hour: EST(UTC-5) 기간의 UTC 17:00은 날짜+시간으로 포맷된다', () => {
            const formatter = getTimeFormatter('1Hour');
            expect(formatter(EST_TIMESTAMP_SECONDS)).toBe('1/15 12:00');
        });
    });

    describe('월 이름 경계', () => {
        it('1월은 Jan으로 표시된다', () => {
            const formatter = getTimeFormatter('1Day');
            // 2024-01-15 12:00:00 UTC = 2024-01-15 07:00:00 EST (UTC-5)
            const janTimestamp =
                new Date('2024-01-15T12:00:00Z').getTime() / 1000;
            expect(formatter(janTimestamp)).toBe('Jan 15');
        });

        it('12월은 Dec으로 표시된다', () => {
            const formatter = getTimeFormatter('1Day');
            // 2024-12-25 12:00:00 UTC = 2024-12-25 07:00:00 EST (UTC-5)
            const decTimestamp =
                new Date('2024-12-25T12:00:00Z').getTime() / 1000;
            expect(formatter(decTimestamp)).toBe('Dec 25');
        });
    });
});
