import { getEasternOffsetHours } from '@/domain/time/eastern';

describe('eastern', () => {
    describe('getEasternOffsetHours', () => {
        describe('EST 기간 (11월 첫 번째 일요일 ~ 3월 두 번째 일요일)', () => {
            it('1월 중순은 EST(UTC-5)를 반환한다', () => {
                const date = new Date('2024-01-15T12:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-5);
            });

            it('3월 DST 시작 직전은 EST(UTC-5)를 반환한다', () => {
                // 2024년 3월 10일 두 번째 일요일 현지 02:00 EST → UTC 07:00 전
                const date = new Date('2024-03-10T06:59:59Z');
                expect(getEasternOffsetHours(date)).toBe(-5);
            });

            it('11월 DST 종료 이후는 EST(UTC-5)를 반환한다', () => {
                // 2024년 11월 3일 첫 번째 일요일 현지 02:00 EDT → UTC 06:00 이후
                const date = new Date('2024-11-03T06:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-5);
            });

            it('12월은 EST(UTC-5)를 반환한다', () => {
                const date = new Date('2024-12-25T15:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-5);
            });
        });

        describe('EDT 기간 (3월 두 번째 일요일 ~ 11월 첫 번째 일요일)', () => {
            it('3월 DST 시작 시점은 EDT(UTC-4)를 반환한다', () => {
                // 2024년 3월 10일 두 번째 일요일 현지 02:00 EST → UTC 07:00
                const date = new Date('2024-03-10T07:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-4);
            });

            it('6월 중순은 EDT(UTC-4)를 반환한다', () => {
                const date = new Date('2024-06-15T12:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-4);
            });

            it('11월 DST 종료 직전은 EDT(UTC-4)를 반환한다', () => {
                // 2024년 11월 3일 첫 번째 일요일 현지 02:00 EDT → UTC 06:00 직전
                const date = new Date('2024-11-03T05:59:59Z');
                expect(getEasternOffsetHours(date)).toBe(-4);
            });
        });

        describe('연도별 DST 경계 검증', () => {
            it('2023년 3월 12일 두 번째 일요일 시작은 EDT를 반환한다', () => {
                // 현지 02:00 EST → UTC 07:00
                const date = new Date('2023-03-12T07:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-4);
            });

            it('2023년 11월 5일 첫 번째 일요일 종료는 EST를 반환한다', () => {
                // 현지 02:00 EDT → UTC 06:00
                const date = new Date('2023-11-05T06:00:00Z');
                expect(getEasternOffsetHours(date)).toBe(-5);
            });

            it('월의 1일이 일요일인 연도(2020년)의 DST 경계를 올바르게 계산한다', () => {
                // 2020-03-01은 일요일 → 두 번째 일요일 = 3월 8일 → UTC 07:00
                const beforeDst = new Date('2020-03-08T06:59:59Z');
                const onDstStart = new Date('2020-03-08T07:00:00Z');
                expect(getEasternOffsetHours(beforeDst)).toBe(-5);
                expect(getEasternOffsetHours(onDstStart)).toBe(-4);
            });
        });
    });
});
