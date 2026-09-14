import { describe, expect, it } from 'vitest';

import {
    fmpCalendarDateTimeToIso,
    fmpCalendarDateTimeToKst,
    kstDateKey,
    kstDateKeyDaysBefore,
    nthSundayDay,
} from '../etTimeUtils';

// ------------------------------------------------------------------
// nthSundayDay
// ------------------------------------------------------------------
describe('nthSundayDay', () => {
    it('반환값: 2026년 3월 2번째 일요일 = 8일 (3월 1일이 일요일이므로 firstSundayOffset=0)', () => {
        // March 2026: 1st day = Sunday (getUTCDay()=0) → firstSundayOffset = (7-0)%7 = 0
        // 1st Sunday = 1 + 0 = 1, 2nd Sunday = 1 + 7 = 8
        expect(nthSundayDay(2026, 2, 2)).toBe(8);
    });

    it('firstSundayOffset=0 경계: March 2026 1번째 일요일 = 1일', () => {
        expect(nthSundayDay(2026, 2, 1)).toBe(1);
    });

    it('2024년 3월 2번째 일요일 = 10일 (3월 1일이 금요일)', () => {
        // March 2024: 1st day = Friday (getUTCDay()=5) → firstSundayOffset = (7-5)%7 = 2
        // 1st Sunday = 3, 2nd Sunday = 10
        expect(nthSundayDay(2024, 2, 2)).toBe(10);
    });

    it('2024년 11월 1번째 일요일 = 3일', () => {
        // Nov 2024: 1st day = Friday → firstSundayOffset = 2 → 1st Sunday = 3
        expect(nthSundayDay(2024, 10, 1)).toBe(3);
    });

    it('4번째 일요일: 2026년 3월 4번째 일요일 = 22일', () => {
        // March 2026: 1st Sunday = 1, 4th Sunday = 1 + 3*7 = 22
        expect(nthSundayDay(2026, 2, 4)).toBe(22);
    });

    it('2026년 11월 1번째 일요일 = 1일 (11월 1일이 일요일)', () => {
        // Nov 2026: 1st day = Sunday → firstSundayOffset = 0 → 1st Sunday = 1
        expect(nthSundayDay(2026, 10, 1)).toBe(1);
    });
});

// ------------------------------------------------------------------
// fmpCalendarDateTimeToIso
//
// FMP `economic-calendar`의 `date`는 존 마커 없는 UTC 벽시계다(실측:
// "2026-09-16 18:00:00 Fed Interest Rate Decision" = FOMC 14:00 EDT =
// 18:00 UTC). DST와 무관하게 항상 `Z`만 붙는다 — 겨울 샘플로 그 무관함을
// 증명한다.
// ------------------------------------------------------------------
describe('fmpCalendarDateTimeToIso', () => {
    it('여름 날짜: 공백 → T 치환 + Z 부여 (DST 오프셋 없음)', () => {
        expect(fmpCalendarDateTimeToIso('2026-07-04 10:30:00')).toBe(
            '2026-07-04T10:30:00Z'
        );
    });

    it('겨울 날짜: 공백 → T 치환 + Z 부여 (여름과 동일하게 오프셋 없음)', () => {
        expect(fmpCalendarDateTimeToIso('2026-12-25 09:00:00')).toBe(
            '2026-12-25T09:00:00Z'
        );
    });

    it('실측: CPI 12:30 UTC', () => {
        expect(fmpCalendarDateTimeToIso('2026-09-11 12:30:00')).toBe(
            '2026-09-11T12:30:00Z'
        );
    });

    it('반환 형식 불변식: YYYY-MM-DDTHH:mm:ssZ', () => {
        const result = fmpCalendarDateTimeToIso('2026-03-08 02:30:00');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
});

// ------------------------------------------------------------------
// fmpCalendarDateTimeToKst
// ------------------------------------------------------------------
describe('fmpCalendarDateTimeToKst', () => {
    it('실측: CPI 2026-09-11 12:30 UTC → KST 같은 날 21:30', () => {
        const result = fmpCalendarDateTimeToKst('2026-09-11 12:30:00', 'ko');
        expect(result.iso).toBe('2026-09-11T12:30:00Z');
        expect(result.kstDateKey).toBe('2026-09-11');
        expect(result.kstTimeLabel).toBe('오후 9:30');
    });

    it('실측: Fed 금리결정 2026-09-16 18:00 UTC → KST 다음날 03:00 (날짜 롤오버)', () => {
        const result = fmpCalendarDateTimeToKst('2026-09-16 18:00:00', 'ko');
        expect(result.iso).toBe('2026-09-16T18:00:00Z');
        expect(result.kstDateKey).toBe('2026-09-17');
        expect(result.kstTimeLabel).toBe('오전 3:00');
    });

    it('겨울 날짜: DST 오프셋이 적용되지 않는다', () => {
        // 2026-12-10 14:30 UTC + 9h = KST 2026-12-10 23:30. ET로 오인했다면
        // (EST -05:00) 09:30으로 읽혀 KST 23:30이 아니라 다른 값이 나왔을 것이다.
        const result = fmpCalendarDateTimeToKst('2026-12-10 14:30:00', 'ko');
        expect(result.iso).toBe('2026-12-10T14:30:00Z');
        expect(result.kstDateKey).toBe('2026-12-10');
        expect(result.kstTimeLabel).toBe('오후 11:30');
    });

    it('kstDateKey 형식은 YYYY-MM-DD', () => {
        const result = fmpCalendarDateTimeToKst('2026-06-19 09:00:00', 'ko');
        expect(result.kstDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('1자리 월/일도 2자리 패딩(01, 09)된다', () => {
        // '2026-01-02 09:00:00' UTC → KST +9h = 2026-01-02 18:00
        const result = fmpCalendarDateTimeToKst('2026-01-02 09:00:00', 'ko');
        expect(result.kstDateKey).toBe('2026-01-02');
        expect(result.kstDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

// ------------------------------------------------------------------
// kstDateKey
// ------------------------------------------------------------------
describe('kstDateKey', () => {
    it('KST 자정 직전은 그 전날로 남는다', () => {
        // 2026-09-01T14:59:59Z = KST 2026-09-01 23:59:59
        expect(kstDateKey(new Date('2026-09-01T14:59:59.000Z'))).toBe(
            '2026-09-01'
        );
    });

    it('KST 자정을 넘기면 다음 날이 된다', () => {
        // 2026-09-01T15:00:00Z = KST 2026-09-02 00:00:00
        expect(kstDateKey(new Date('2026-09-01T15:00:00.000Z'))).toBe(
            '2026-09-02'
        );
    });

    it('월·일을 2자리로 0 채움한다', () => {
        expect(kstDateKey(new Date('2026-01-05T03:00:00.000Z'))).toBe(
            '2026-01-05'
        );
    });
});

/**
 * 로케일 + 오전/오후 회귀.
 *
 * 예전에는 포맷터가 `'ko-KR'` 고정이었고, 캘린더 월 셀은 그 결과를
 * 정규식으로 오전·오후 접두사를 깎아 폭을 맞췄다. 로케일을 따르게 만든
 * 순간 그 깎기가 무력해져 `8:30 AM`·`午前8:30`·`上午8:30`이 셀을 넘쳤다 —
 * 문자열 후처리가 아니라 **포맷 옵션**으로 껐다.
 */
describe('fmpCalendarDateTimeToKst — 로케일과 hour12', () => {
    const UTC_SAMPLE = '2026-01-12 18:30:00';

    it('ko 기본은 오전/오후를 붙인다', () => {
        expect(fmpCalendarDateTimeToKst(UTC_SAMPLE, 'ko').kstTimeLabel).toMatch(
            /^오전|^오후/
        );
    });

    it.each(['en', 'ja', 'zh'] as const)('%s는 한글을 쓰지 않는다', locale => {
        expect(
            fmpCalendarDateTimeToKst(UTC_SAMPLE, locale).kstTimeLabel
        ).not.toMatch(/[가-힣]/);
    });

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: hour12=false면 오전/오후 표기가 없다',
        locale => {
            const label = fmpCalendarDateTimeToKst(
                UTC_SAMPLE,
                locale,
                false
            ).kstTimeLabel;

            expect(label).not.toMatch(/오전|오후|AM|PM|午前|午後|上午|下午/);
            expect(label).toMatch(/\d/);
        }
    );
});

// ------------------------------------------------------------------
// kstDateKeyDaysBefore
// ------------------------------------------------------------------
describe('kstDateKeyDaysBefore', () => {
    it('보존 기간 400일을 뺀다', () => {
        // /api/presence의 정리 기준일. 이 값이 바뀌면 방침 본문도 바꿔야 한다.
        expect(kstDateKeyDaysBefore('2026-09-02', 400)).toBe('2025-07-29');
    });

    it('30일 창을 뺀다', () => {
        expect(kstDateKeyDaysBefore('2026-09-02', 30)).toBe('2026-08-03');
    });

    it('월 경계를 넘는다', () => {
        expect(kstDateKeyDaysBefore('2026-03-01', 1)).toBe('2026-02-28');
    });

    it('윤년 2월을 통과한다', () => {
        // 2028은 윤년이라 3월 1일의 하루 전은 2월 29일이다.
        expect(kstDateKeyDaysBefore('2028-03-01', 1)).toBe('2028-02-29');
    });

    it('0일이면 그대로다', () => {
        expect(kstDateKeyDaysBefore('2026-09-02', 0)).toBe('2026-09-02');
    });
});
