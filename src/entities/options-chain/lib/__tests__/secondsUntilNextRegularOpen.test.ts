import { secondsUntilNextRegularOpen } from '../secondsUntilNextRegularOpen';

describe('secondsUntilNextRegularOpen', () => {
    it('평일 개장 전이면 같은 날 09:30 ET까지다', () => {
        // 2026-10-05(월) 08:30 EDT = 12:30 UTC → 개장(13:30 UTC)까지 1시간.
        expect(
            secondsUntilNextRegularOpen(new Date('2026-10-05T12:30:00.000Z'))
        ).toBe(3600);
    });

    it('개장 1초 전이면 1초다', () => {
        expect(
            secondsUntilNextRegularOpen(new Date('2026-10-05T13:29:59.000Z'))
        ).toBe(1);
    });

    it('정규장 중에는 다음 거래일 개장까지다', () => {
        // 2026-10-05(월) 11:00 EDT → 화요일 09:30 EDT까지 22.5시간.
        expect(
            secondsUntilNextRegularOpen(new Date('2026-10-05T15:00:00.000Z'))
        ).toBe(22.5 * 3600);
    });

    it('금요일 저녁에는 월요일 개장까지(주말을 건넌다)', () => {
        // 2026-10-09(금) 20:00 EDT = 10-10 00:00 UTC → 월요일 10-12 13:30 UTC.
        const now = new Date('2026-10-10T00:00:00.000Z');
        const expected =
            (Date.parse('2026-10-12T13:30:00.000Z') - now.getTime()) / 1000;
        expect(secondsUntilNextRegularOpen(now)).toBe(expected);
    });

    it('휴장일을 건넌다(2026-11-26 추수감사절 → 금요일 개장)', () => {
        // 2026-11-25(수) 20:00 EST = 11-26 01:00 UTC. 목요일은 휴장, 금요일 09:30 EST = 14:30 UTC.
        const now = new Date('2026-11-26T01:00:00.000Z');
        const expected =
            (Date.parse('2026-11-27T14:30:00.000Z') - now.getTime()) / 1000;
        expect(secondsUntilNextRegularOpen(now)).toBe(expected);
    });

    it('표준시(EST)에서는 개장이 14:30 UTC다', () => {
        // 2026-12-01(화) 09:00 EST = 14:00 UTC → 30분.
        expect(
            secondsUntilNextRegularOpen(new Date('2026-12-01T14:00:00.000Z'))
        ).toBe(1800);
    });

    describe('DST 전환을 건너는 주말', () => {
        const secondsBetween = (now: Date, openUtc: string): number =>
            (Date.parse(openUtc) - now.getTime()) / 1000;

        it('EDT 금요일 저녁 → 월요일 09:30 EST(14:30 UTC) (가을 전환)', () => {
            // 2026-10-30(금) 20:00 EDT = 10-31 00:00 UTC. 11-01 02:00에 EST로 돌아간다.
            const now = new Date('2026-10-31T00:00:00.000Z');

            expect(secondsUntilNextRegularOpen(now)).toBe(
                secondsBetween(now, '2026-11-02T14:30:00.000Z')
            );
        });

        it('EST 금요일 저녁 → 월요일 09:30 EDT(13:30 UTC) (봄 전환)', () => {
            // 2026-03-06(금) 20:00 EST = 03-07 01:00 UTC. 03-08 02:00에 EDT로 넘어간다.
            const now = new Date('2026-03-07T01:00:00.000Z');

            expect(secondsUntilNextRegularOpen(now)).toBe(
                secondsBetween(now, '2026-03-09T13:30:00.000Z')
            );
        });
    });
});
