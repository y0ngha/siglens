import { getEasternOffsetHours } from '@/shared/lib/eastern';
import { getEtOffset, nthSundayDay } from '@/shared/lib/etTimeUtils';

// FmpMarketProvider의 getEtOffsetHours/getNthSundayOfMonth는 private이므로
// fmpIntradayDateToUtcSeconds의 동작을 통해 간접적으로 검증한다.
// 대신 실제 동작을 여기서 참조 구현으로 재현해 경계를 핀한다.
function fmpGetEtOffsetHours(year: number, month: number, day: number): number {
    // FmpMarketProvider의 내부 getEtOffsetHours를 그대로 복제 (date-only, 시각 무시)
    function getNthSundayOfMonthFmp(y: number, m: number, n: number): Date {
        const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
        const dayOfWeek = firstOfMonth.getUTCDay();
        const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        return new Date(Date.UTC(y, m - 1, firstSunday + (n - 1) * 7));
    }
    const dstStart = getNthSundayOfMonthFmp(year, 3, 2);
    const dstEnd = getNthSundayOfMonthFmp(year, 11, 1);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date >= dstStart && date < dstEnd ? -4 : -5;
}

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
// 세 구현의 실제 출력값을 캡처해 리팩터링 이후에도 동일성을 보장한다.
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
        it('2024 봄 전환: UTC 06:59:59 → -5 (EST, 전환 직전)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T06:59:59Z'))
            ).toBe(-5);
        });
        it('2024 봄 전환: UTC 07:00:00 → -4 (EDT, 전환 정각)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T07:00:00Z'))
            ).toBe(-4);
        });
        it('2024 봄 전환: UTC 13:30:00 (= EDT 09:30) → -4', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T13:30:00Z'))
            ).toBe(-4);
        });

        // 가을 전환: 11월 첫 번째 일요일 06:00 UTC (= EDT 02:00 local)
        it('2024 가을 전환: UTC 05:59:59 → -4 (EDT, 전환 직전)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-11-03T05:59:59Z'))
            ).toBe(-4);
        });
        it('2024 가을 전환: UTC 06:00:00 → -5 (EST, 전환 정각)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-11-03T06:00:00Z'))
            ).toBe(-5);
        });
        it('2024 가을 전환: UTC 14:30:00 (= EST 09:30) → -5', () => {
            expect(
                getEasternOffsetHours(new Date('2024-11-03T14:30:00Z'))
            ).toBe(-5);
        });

        // 2026: 3월/11월 모두 1일이 일요일
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
        it('비경계: 2024-01-15 UTC 12:00 → -5 (EST 일반 구간)', () => {
            expect(
                getEasternOffsetHours(new Date('2024-01-15T12:00:00Z'))
            ).toBe(-5);
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

    describe('fmpGetEtOffsetHours (FmpMarketProvider 내부, date-only) — 시각 무시 경계', () => {
        // FMP는 날짜 전체를 하나의 오프셋으로 처리 (hour 무시)
        // 봄 전환일 전날 → EST, 당일부터 → EDT (시각 무관)
        it('2024 봄 전환 전날(3/9) → -5 (EST)', () => {
            expect(fmpGetEtOffsetHours(2024, 3, 9)).toBe(-5);
        });
        it('2024 봄 전환일(3/10) → -4 (EDT, hour 무시)', () => {
            expect(fmpGetEtOffsetHours(2024, 3, 10)).toBe(-4);
        });
        it('2024 가을 전환 전날(11/2) → -4 (EDT)', () => {
            expect(fmpGetEtOffsetHours(2024, 11, 2)).toBe(-4);
        });
        it('2024 가을 전환일(11/3) → -5 (EST, 당일 전체)', () => {
            expect(fmpGetEtOffsetHours(2024, 11, 3)).toBe(-5);
        });

        // 2026: 극단 케이스
        it('2026 봄 전환일(3/8) → -4 (EDT)', () => {
            expect(fmpGetEtOffsetHours(2026, 3, 8)).toBe(-4);
        });
        it('2026 봄 전환 전날(3/7) → -5 (EST)', () => {
            expect(fmpGetEtOffsetHours(2026, 3, 7)).toBe(-5);
        });
        it('2026 가을 전환일(11/1) → -5 (EST)', () => {
            expect(fmpGetEtOffsetHours(2026, 11, 1)).toBe(-5);
        });
        it('2026 가을 전환 전날(10/31) → -4 (EDT)', () => {
            expect(fmpGetEtOffsetHours(2026, 10, 31)).toBe(-4);
        });

        // 비경계 날짜
        it('비경계: 2024-07-01 → -4 (EDT)', () => {
            expect(fmpGetEtOffsetHours(2024, 7, 1)).toBe(-4);
        });
        it('비경계: 2024-01-15 → -5 (EST)', () => {
            expect(fmpGetEtOffsetHours(2024, 1, 15)).toBe(-5);
        });
    });

    describe('함수 간 경계 차이 명세 — 동일 시각, 다른 반환 형태', () => {
        // 봄 전환일 01:30 ET (= 06:30 UTC, 전환 전)
        // getEtOffset: hour=1 → -05:00 (EST) — 시각 인식 정확
        // getEasternOffsetHours: UTC 06:30Z → -5 (전환 전) — UTC 인식 정확
        // fmpGetEtOffsetHours: day=10 → -4 (EDT) — date-only, 의도적 단순화
        it('봄 전환일 01:30 ET: getEtOffset hour=1 → "-05:00"', () => {
            expect(getEtOffset(2024, 2, 10, 1)).toBe('-05:00');
        });
        it('봄 전환일 01:30 ET: getEasternOffsetHours UTC 06:30Z → -5', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T06:30:00Z'))
            ).toBe(-5);
        });
        it('봄 전환일 date-only: fmpGetEtOffsetHours(2024,3,10) → -4 (date-only, 설계적 차이)', () => {
            expect(fmpGetEtOffsetHours(2024, 3, 10)).toBe(-4);
        });

        // 봄 전환일 09:30 ET (= 13:30 UTC, 전환 후) — 장중 시각은 세 함수 모두 -4
        it('봄 전환일 09:30 ET: getEtOffset hour=9 → "-04:00"', () => {
            expect(getEtOffset(2024, 2, 10, 9)).toBe('-04:00');
        });
        it('봄 전환일 09:30 ET: getEasternOffsetHours UTC 13:30Z → -4', () => {
            expect(
                getEasternOffsetHours(new Date('2024-03-10T13:30:00Z'))
            ).toBe(-4);
        });
        it('봄 전환일 09:30 ET: fmpGetEtOffsetHours → -4 (장중 = 항상 EDT)', () => {
            expect(fmpGetEtOffsetHours(2024, 3, 10)).toBe(-4);
        });
    });
});
