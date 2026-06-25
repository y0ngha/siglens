import { getEasternOffsetHours } from '@/shared/lib/eastern';
import { getEtOffset, nthSundayDay } from '@/shared/lib/etTimeUtils';

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

// ============================================================
// 경계 동치 핀 테스트 (PR4 통합 검증용)
// eastern.ts / etTimeUtils.ts 두 정식 공개 함수의 실제 출력값을 캡처해
// 리팩터링 이후에도 동일성을 보장한다.
// FMP date-only 경계는 FmpMarketProvider.test.ts DST-boundary 케이스가
// getBars 실 경로를 통해 종단 검증하므로 여기서 중복 복제하지 않는다.
// ============================================================

describe('DST 경계 동치 핀 — 통합 전 실제 출력 캡처', () => {
    // 2024: 봄 전환 = 3월 10일, 가을 전환 = 11월 3일
    // 2026: 봄 전환 = 3월 8일,  가을 전환 = 11월 1일  (3월/11월 1일 모두 일요일)

    describe('nthSundayDay (etTimeUtils) — 경계 날짜 계산 정확성', () => {
        it('2024 봄 전환일 = 3월 10일 (month=2, 0-indexed)', () => {
            expect(nthSundayDay(2024, 2, 2)).toBe(10);
        });
        it('2024 가을 전환일 = 11월 3일 (month=10, 0-indexed)', () => {
            expect(nthSundayDay(2024, 10, 1)).toBe(3);
        });
        it('2026 봄 전환일 = 3월 8일 (3월 1일이 일요일인 경우)', () => {
            expect(nthSundayDay(2026, 2, 2)).toBe(8);
        });
        it('2026 가을 전환일 = 11월 1일 (11월 1일이 일요일인 경우)', () => {
            expect(nthSundayDay(2026, 10, 1)).toBe(1);
        });
    });

    describe('getEasternOffsetHours (eastern.ts) — UTC 순간 기반 경계', () => {
        // 봄 전환: 3월 두 번째 일요일 07:00 UTC (= EST 02:00 local)
        // 전환 직전(06:59:59)/정각(07:00:00) 경계는 상단 describe('eastern')에서 이미 검증
        it('2024 봄 전환: UTC 13:30:00 (= EDT 09:30) → -4', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T13:30:00Z'))
            ).toBe(-4);
        });

        // 가을 전환: 11월 첫 번째 일요일 06:00 UTC (= EDT 02:00 local)
        // 전환 직전(05:59:59)/정각(06:00:00) 경계는 상단 describe('eastern')에서 이미 검증
        it('2024 가을 전환: UTC 14:30:00 (= EST 09:30) → -5', () => {
            expect(
                getEasternOffsetHours(new Date('2024-11-03T14:30:00Z'))
            ).toBe(-5);
        });

        // 2026: 3월/11월 모두 1일이 일요일 — nthSundayDay 극단 케이스 신규 검증
        it('2026 봄 전환(3/8): UTC 06:59:59 → -5', () => {
            expect(
                getEasternOffsetHours(new Date('2026-03-08T06:59:59Z'))
            ).toBe(-5);
        });
        it('2026 봄 전환(3/8): UTC 07:00:00 → -4', () => {
            expect(
                getEasternOffsetHours(new Date('2026-03-08T07:00:00Z'))
            ).toBe(-4);
        });
        it('2026 가을 전환(11/1): UTC 05:59:59 → -4', () => {
            expect(
                getEasternOffsetHours(new Date('2026-11-01T05:59:59Z'))
            ).toBe(-4);
        });
        it('2026 가을 전환(11/1): UTC 06:00:00 → -5', () => {
            expect(
                getEasternOffsetHours(new Date('2026-11-01T06:00:00Z'))
            ).toBe(-5);
        });

        // 비경계 날짜 (일반 구간)
        it('비경계: 2024-07-01 UTC 12:00 → -4 (EDT 일반 구간)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-07-01T12:00:00Z'))
            ).toBe(-4);
        });
    });

    describe('getEtOffset (etTimeUtils.ts) — ET 로컬 시각 기반, 시각 인식 경계', () => {
        // 봄 전환일: 해당 연도·월·일에서 hour < 2 → EST, >= 2 → EDT
        it('2024 봄 전환일(3/10) hour=1 → "-05:00" (02:00 전 EST)', () => {
            expect(getEtOffset(2024, 2, 10, 1)).toBe('-05:00');
        });
        it('2024 봄 전환일(3/10) hour=2 → "-04:00" (02:00 이후 EDT)', () => {
            expect(getEtOffset(2024, 2, 10, 2)).toBe('-04:00');
        });
        it('2024 봄 전환일(3/10) hour=3 → "-04:00"', () => {
            expect(getEtOffset(2024, 2, 10, 3)).toBe('-04:00');
        });
        it('2024 봄 전환일(3/10) hour=9 → "-04:00" (장중 시각)', () => {
            expect(getEtOffset(2024, 2, 10, 9)).toBe('-04:00');
        });

        // 가을 전환일: hour < 2 → EDT, >= 2 → EST
        it('2024 가을 전환일(11/3) hour=1 → "-04:00" (02:00 전 EDT)', () => {
            expect(getEtOffset(2024, 10, 3, 1)).toBe('-04:00');
        });
        it('2024 가을 전환일(11/3) hour=2 → "-05:00" (02:00 이후 EST)', () => {
            expect(getEtOffset(2024, 10, 3, 2)).toBe('-05:00');
        });
        it('2024 가을 전환일(11/3) hour=9 → "-05:00" (장중 시각)', () => {
            expect(getEtOffset(2024, 10, 3, 9)).toBe('-05:00');
        });

        // 2026: 1일이 일요일인 극단 케이스
        it('2026 봄 전환일(3/8) hour=1 → "-05:00"', () => {
            expect(getEtOffset(2026, 2, 8, 1)).toBe('-05:00');
        });
        it('2026 봄 전환일(3/8) hour=2 → "-04:00"', () => {
            expect(getEtOffset(2026, 2, 8, 2)).toBe('-04:00');
        });
        it('2026 가을 전환일(11/1) hour=1 → "-04:00"', () => {
            expect(getEtOffset(2026, 10, 1, 1)).toBe('-04:00');
        });
        it('2026 가을 전환일(11/1) hour=2 → "-05:00"', () => {
            expect(getEtOffset(2026, 10, 1, 2)).toBe('-05:00');
        });

        // 비경계 날짜
        it('비경계: 2024-07-01 hour=12 → "-04:00" (EDT)', () => {
            expect(getEtOffset(2024, 6, 1, 12)).toBe('-04:00');
        });
        it('비경계: 2024-01-15 hour=12 → "-05:00" (EST)', () => {
            expect(getEtOffset(2024, 0, 15, 12)).toBe('-05:00');
        });
    });
});
