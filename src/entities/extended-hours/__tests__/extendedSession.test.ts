import { describe, it, expect } from 'vitest';
import {
    etDayNumber,
    previousTradingEtDay,
    extendedSessionAt,
} from '@/entities/extended-hours/lib/extendedSession';

const at = (iso: string): Date => new Date(iso);
const kindAt = (iso: string) => extendedSessionAt(at(iso))?.kind ?? null;

/**
 * 2026-10-15(목)은 EDT(UTC-4)다: 04:00 ET = 08:00Z, 09:30 = 13:30Z, 16:00 = 20:00Z, 20:00 = 00:00Z(+1).
 */
describe('extendedSessionAt — 평일 EDT 경계', () => {
    it.each([
        ['03:59 ET', '2026-10-15T07:59:00Z', null],
        ['04:00 ET 정각', '2026-10-15T08:00:00Z', 'pre-market'],
        ['09:29:59 ET', '2026-10-15T13:29:59.999Z', 'pre-market'],
        ['09:30 ET 정각(정규장 시작)', '2026-10-15T13:30:00Z', null],
        ['정규장 한가운데 12:00 ET', '2026-10-15T16:00:00Z', null],
        ['15:59 ET(정규장)', '2026-10-15T19:59:59Z', null],
        ['16:00 ET 정각', '2026-10-15T20:00:00Z', 'after-hours'],
        ['19:59:59 ET', '2026-10-15T23:59:59.999Z', 'after-hours'],
        ['20:00 ET 정각(종료)', '2026-10-16T00:00:00Z', null],
        ['심야 ET', '2026-10-16T03:00:00Z', null],
    ])('%s → %s', (_label, iso, expected) => {
        expect(kindAt(iso)).toBe(expected);
    });

    it('세션 창의 시작·종료는 그 날 ET 벽시계에서 계산된다', () => {
        const pre = extendedSessionAt(at('2026-10-15T11:07:12Z'));
        expect(pre).toMatchObject({
            kind: 'pre-market',
            startMs: Date.UTC(2026, 9, 15, 8, 0),
            endMs: Date.UTC(2026, 9, 15, 13, 30),
        });

        const after = extendedSessionAt(at('2026-10-15T21:00:00Z'));
        expect(after).toMatchObject({
            kind: 'after-hours',
            startMs: Date.UTC(2026, 9, 15, 20, 0),
            endMs: Date.UTC(2026, 9, 16, 0, 0),
        });
    });
});

describe('extendedSessionAt — 주말·휴장일', () => {
    it.each([
        ['토요일 프리 시각', '2026-10-17T12:00:00Z'],
        ['일요일 애프터 시각', '2026-10-18T21:00:00Z'],
        ['추수감사절(2026-11-26) 프리 시각', '2026-11-26T11:00:00Z'],
        ['성탄절(2026-12-25) 애프터 시각', '2026-12-25T22:00:00Z'],
        // 7/4가 토요일이면 거래소는 금요일 7/3에 쉰다(관측일 이동).
        ['독립기념일 관측일(2026-07-03) 프리 시각', '2026-07-03T12:00:00Z'],
        ['노동절(2026-09-07) 애프터 시각', '2026-09-07T21:00:00Z'],
    ])('%s → null', (_label, iso) => {
        expect(extendedSessionAt(at(iso))).toBeNull();
    });
});

describe('extendedSessionAt — 반장일(13:00 마감)', () => {
    // 2026-11-27(금, 추수감사절 다음 날)은 EST(UTC-5): 13:00 ET = 18:00Z, 17:00 ET = 22:00Z.
    it.each([
        ['프리마켓은 평소처럼 04:00 ET', '2026-11-27T09:00:00Z', 'pre-market'],
        ['12:59 ET는 아직 정규장', '2026-11-27T17:59:00Z', null],
        [
            '13:00 ET에 애프터마켓이 시작한다',
            '2026-11-27T18:00:00Z',
            'after-hours',
        ],
        ['16:30 ET도 애프터마켓', '2026-11-27T21:30:00Z', 'after-hours'],
        ['17:00 ET에 반장일 애프터마켓이 끝난다', '2026-11-27T22:00:00Z', null],
        ['19:00 ET는 닫힘', '2026-11-28T00:00:00Z', null],
    ])('%s', (_label, iso, expected) => {
        expect(kindAt(iso)).toBe(expected);
    });

    it('반장일 애프터마켓 창은 13:00~17:00 ET다', () => {
        expect(extendedSessionAt(at('2026-11-27T19:00:00Z'))).toMatchObject({
            startMs: Date.UTC(2026, 10, 27, 18, 0),
            endMs: Date.UTC(2026, 10, 27, 22, 0),
        });
    });
});

describe('extendedSessionAt — DST 전환 주변', () => {
    // 2026-03-08(일) 02:00에 EST→EDT. 금 3/6은 EST(04:00 ET = 09:00Z), 월 3/9는 EDT(= 08:00Z).
    it.each([
        ['전환 전 금요일 03:59 EST', '2026-03-06T08:59:00Z', null],
        ['전환 전 금요일 04:00 EST', '2026-03-06T09:00:00Z', 'pre-market'],
        ['전환 후 월요일 03:59 EDT', '2026-03-09T07:59:00Z', null],
        ['전환 후 월요일 04:00 EDT', '2026-03-09T08:00:00Z', 'pre-market'],
        ['전환 후 월요일 16:00 EDT', '2026-03-09T20:00:00Z', 'after-hours'],
        ['전환 전 금요일 16:00 EST', '2026-03-06T21:00:00Z', 'after-hours'],
    ])('봄 전환: %s', (_label, iso, expected) => {
        expect(kindAt(iso)).toBe(expected);
    });

    // 2026-11-01(일) 02:00에 EDT→EST. 금 10/30은 EDT(08:00Z), 월 11/2는 EST(09:00Z).
    it.each([
        ['전환 전 금요일 04:00 EDT', '2026-10-30T08:00:00Z', 'pre-market'],
        ['전환 전 금요일 03:59 EDT', '2026-10-30T07:59:00Z', null],
        ['전환 후 월요일 04:00 EST', '2026-11-02T09:00:00Z', 'pre-market'],
        ['전환 후 월요일 03:59 EST', '2026-11-02T08:59:00Z', null],
        ['전환 후 월요일 19:59 EST', '2026-11-03T00:59:00Z', 'after-hours'],
        ['전환 후 월요일 20:00 EST', '2026-11-03T01:00:00Z', null],
    ])('가을 전환: %s', (_label, iso, expected) => {
        expect(kindAt(iso)).toBe(expected);
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

describe('previousTradingEtDay', () => {
    const day = (y: number, m: number, d: number) =>
        etDayNumber(Date.UTC(y, m - 1, d, 17));

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
