import { describe, it, expect } from 'vitest';
import {
    AFTER_HOURS_END_MINUTE,
    EARLY_CLOSE_AFTER_HOURS_END_MINUTE,
    PRE_MARKET_OPEN_MINUTE,
    etDayNumber,
    etDayWallMs,
    etWallClock,
    isTradingEtDay,
    previousTradingEtDay,
    usSessionDayAt,
} from '@/shared/api/market/usSessionClock';

const day = (y: number, m: number, d: number) =>
    etDayNumber(Date.UTC(y, m - 1, d, 17));

describe('세션 경계 상수', () => {
    it('프리 04:00·애프터 20:00·반장일 애프터 17:00(ET 분)', () => {
        expect(PRE_MARKET_OPEN_MINUTE).toBe(240);
        expect(AFTER_HOURS_END_MINUTE).toBe(1200);
        expect(EARLY_CLOSE_AFTER_HOURS_END_MINUTE).toBe(1020);
    });
});

describe('etDayNumber', () => {
    it('ET 자정 직전·직후는 다른 날짜 번호다', () => {
        // 2026-10-15 23:59 ET = 03:59Z(+1) / 2026-10-16 00:00 ET = 04:00Z(+1)
        const before = etDayNumber(Date.UTC(2026, 9, 16, 3, 59));
        const after = etDayNumber(Date.UTC(2026, 9, 16, 4, 0));
        expect(after - before).toBe(1);
    });

    it('UTC로는 다음 날이지만 ET로는 같은 날인 저녁 시각을 같은 날로 센다', () => {
        const noon = etDayNumber(Date.UTC(2026, 9, 15, 16, 0));
        const evening = etDayNumber(Date.UTC(2026, 9, 16, 0, 30)); // 20:30 EDT
        expect(evening).toBe(noon);
    });
});

describe('etWallClock', () => {
    it('EDT 04:00 ET(08:00Z)는 240분, EST 04:00 ET(09:00Z)도 240분', () => {
        expect(etWallClock(Date.UTC(2026, 9, 15, 8, 0)).minuteOfDay).toBe(240);
        expect(etWallClock(Date.UTC(2026, 11, 15, 9, 0)).minuteOfDay).toBe(240);
    });

    it('날 번호는 etDayNumber와 같다', () => {
        const ms = Date.UTC(2026, 9, 16, 3, 59);
        expect(etWallClock(ms).day).toBe(etDayNumber(ms));
    });
});

describe('etDayWallMs — ET 벽시계를 그 날의 오프셋으로 UTC로 바꾼다', () => {
    it('EDT 날(2026-10-15)의 04:00 ET = 08:00Z', () => {
        expect(etDayWallMs(day(2026, 10, 15), 240)).toBe(
            Date.UTC(2026, 9, 15, 8, 0)
        );
    });

    it('EST 날(2026-12-15)의 04:00 ET = 09:00Z', () => {
        expect(etDayWallMs(day(2026, 12, 15), 240)).toBe(
            Date.UTC(2026, 11, 15, 9, 0)
        );
    });

    it('서머타임 전환 다음 월요일(2026-03-09, EDT)은 전환 전 금요일(EST)과 UTC가 한 시간 다르다', () => {
        expect(etDayWallMs(day(2026, 3, 6), 240)).toBe(
            Date.UTC(2026, 2, 6, 9, 0)
        );
        expect(etDayWallMs(day(2026, 3, 9), 240)).toBe(
            Date.UTC(2026, 2, 9, 8, 0)
        );
    });
});

describe('isTradingEtDay', () => {
    it.each([
        ['평일', day(2026, 10, 15), true],
        ['토요일', day(2026, 10, 17), false],
        ['일요일', day(2026, 10, 18), false],
        ['추수감사절', day(2026, 11, 26), false],
        ['독립기념일 관측일(7/3)', day(2026, 7, 3), false],
        ['반장일도 거래일', day(2026, 11, 27), true],
    ])('%s', (_label, etDay, expected) => {
        expect(isTradingEtDay(etDay)).toBe(expected);
    });
});

describe('previousTradingEtDay', () => {
    it('평일의 직전 거래일은 전날이다', () => {
        expect(previousTradingEtDay(day(2026, 10, 15))).toBe(day(2026, 10, 14));
    });

    it('월요일의 직전 거래일은 금요일이다', () => {
        expect(previousTradingEtDay(day(2026, 10, 19))).toBe(day(2026, 10, 16));
    });

    it('노동절(월) 다음 화요일의 직전 거래일은 금요일이다', () => {
        expect(previousTradingEtDay(day(2026, 9, 8))).toBe(day(2026, 9, 4));
    });

    it('추수감사절(목) 다음 금요일의 직전 거래일은 수요일이다', () => {
        expect(previousTradingEtDay(day(2026, 11, 27))).toBe(day(2026, 11, 25));
    });
});

describe('usSessionDayAt', () => {
    it('정규 거래일: 09:30 개장·16:00 마감·20:00 애프터 종료', () => {
        expect(usSessionDayAt(new Date('2026-10-15T16:00:00Z'))).toEqual({
            tradingDay: true,
            openMinute: 570,
            closeMinute: 960,
            afterHoursEndMinute: 1200,
        });
    });

    it('반장일(2026-11-27): 13:00 마감, 애프터는 17:00에 끝난다', () => {
        expect(usSessionDayAt(new Date('2026-11-27T17:00:00Z'))).toEqual({
            tradingDay: true,
            openMinute: 570,
            closeMinute: 780,
            afterHoursEndMinute: 1020,
        });
    });

    it('휴장일(추수감사절): 거래일이 아니고, core가 주는 마감 0 대신 정규 마감으로 폴백한다', () => {
        const holiday = usSessionDayAt(new Date('2026-11-26T17:00:00Z'));
        expect(holiday.tradingDay).toBe(false);
        expect(holiday.closeMinute).toBe(960);
    });

    it('주말은 거래일이 아니다', () => {
        expect(
            usSessionDayAt(new Date('2026-10-17T15:00:00Z')).tradingDay
        ).toBe(false);
    });
});
