import {
    SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR,
    SECONDS_PER_DAY,
    SECONDS_PER_YEAR,
    MS_PER_SECOND,
    MS_PER_MINUTE,
    MS_PER_HOUR,
    MS_PER_DAY,
} from '@/domain/constants/time';

describe('time constants', () => {
    describe('초 단위 상수', () => {
        it('SECONDS_PER_MINUTE은 60이다', () => {
            expect(SECONDS_PER_MINUTE).toBe(60);
        });

        it('SECONDS_PER_HOUR은 3600이다', () => {
            expect(SECONDS_PER_HOUR).toBe(3600);
        });

        it('SECONDS_PER_DAY은 86400이다', () => {
            expect(SECONDS_PER_DAY).toBe(86400);
        });

        it('SECONDS_PER_YEAR은 31536000이다', () => {
            expect(SECONDS_PER_YEAR).toBe(31_536_000);
        });
    });

    describe('밀리초 단위 상수', () => {
        it('MS_PER_SECOND은 1000이다', () => {
            expect(MS_PER_SECOND).toBe(1000);
        });

        it('MS_PER_MINUTE은 60000이다', () => {
            expect(MS_PER_MINUTE).toBe(60_000);
        });

        it('MS_PER_HOUR은 3600000이다', () => {
            expect(MS_PER_HOUR).toBe(3_600_000);
        });

        it('MS_PER_DAY은 86400000이다', () => {
            expect(MS_PER_DAY).toBe(86_400_000);
        });
    });

    describe('파생 상수 일관성', () => {
        it('SECONDS_PER_HOUR은 SECONDS_PER_MINUTE * 60이다', () => {
            expect(SECONDS_PER_HOUR).toBe(SECONDS_PER_MINUTE * 60);
        });

        it('SECONDS_PER_DAY은 SECONDS_PER_HOUR * 24이다', () => {
            expect(SECONDS_PER_DAY).toBe(SECONDS_PER_HOUR * 24);
        });

        it('SECONDS_PER_YEAR은 SECONDS_PER_DAY * 365이다', () => {
            expect(SECONDS_PER_YEAR).toBe(SECONDS_PER_DAY * 365);
        });

        it('MS_PER_MINUTE은 SECONDS_PER_MINUTE * MS_PER_SECOND이다', () => {
            expect(MS_PER_MINUTE).toBe(SECONDS_PER_MINUTE * MS_PER_SECOND);
        });

        it('MS_PER_HOUR은 SECONDS_PER_HOUR * MS_PER_SECOND이다', () => {
            expect(MS_PER_HOUR).toBe(SECONDS_PER_HOUR * MS_PER_SECOND);
        });

        it('MS_PER_DAY은 SECONDS_PER_DAY * MS_PER_SECOND이다', () => {
            expect(MS_PER_DAY).toBe(SECONDS_PER_DAY * MS_PER_SECOND);
        });
    });
});
