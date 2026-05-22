/**
 * Unit tests for isUsOptionsRegularSession.
 *
 * The boundary is ET Mon–Fri 09:30–16:00. We exercise three branches
 * (weekend, in-session, out-of-session), the exact boundary minutes,
 * and DST correctness (EDT vs EST). All test inputs are exact UTC
 * instants so the assertions stay stable regardless of host TZ.
 *
 * America/New_York DST transitions in 2026:
 *   - Spring forward: 2026-03-08 02:00 → 03:00 (EDT begins, UTC-4)
 *   - Fall back:      2026-11-01 02:00 → 01:00 (EST begins, UTC-5)
 */

import {
    hasAllZeroOpenInterest,
    isUsOptionsRegularSession,
    normalizeHour,
} from '@/domain/market/session';
import type {
    OptionsChain,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

const makeContract = (
    overrides: Partial<OptionsContract> = {}
): OptionsContract => ({
    contractSymbol: 'AAPL250620C00200000',
    strike: 200,
    lastPrice: null,
    bid: null,
    ask: null,
    volume: 0,
    openInterest: 0,
    impliedVolatility: null,
    inTheMoney: false,
    ...overrides,
});

const makeChain = (overrides: Partial<OptionsChain> = {}): OptionsChain => ({
    expirationDate: '2026-06-20',
    daysToExpiration: 30,
    calls: [],
    puts: [],
    ...overrides,
});

const makeSnapshot = (
    chains: ReadonlyArray<OptionsChain>
): OptionsSnapshot => ({
    symbol: 'AAPL',
    underlyingPrice: 200,
    capturedAt: '2026-05-22T00:00:00Z',
    chains,
});

describe('isUsOptionsRegularSession — weekend', () => {
    it('returns false on Saturday (EDT)', () => {
        // 2026-05-23 is a Saturday. 09:30 EDT = 13:30 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-23T13:30:00Z'))
        ).toBe(false);
    });

    it('returns false on Sunday (EDT)', () => {
        // 2026-05-24 is a Sunday. 12:00 EDT = 16:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-24T16:00:00Z'))
        ).toBe(false);
    });

    it('returns false on Saturday (EST)', () => {
        // 2026-01-17 is a Saturday. 10:00 EST = 15:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-01-17T15:00:00Z'))
        ).toBe(false);
    });

    it('returns false on Sunday (EST)', () => {
        // 2026-01-18 is a Sunday. 10:00 EST = 15:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-01-18T15:00:00Z'))
        ).toBe(false);
    });
});

describe('isUsOptionsRegularSession — weekday in regular session (EDT)', () => {
    it('returns true at 09:30 ET (opening boundary)', () => {
        // 2026-05-20 Wed. 09:30 EDT = 13:30 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T13:30:00Z'))
        ).toBe(true);
    });

    it('returns true at 16:00 ET (closing boundary, inclusive)', () => {
        // 2026-05-20 Wed. 16:00 EDT = 20:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T20:00:00Z'))
        ).toBe(true);
    });

    it('returns true at 12:00 ET (midday)', () => {
        // 2026-05-20 Wed. 12:00 EDT = 16:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T16:00:00Z'))
        ).toBe(true);
    });
});

describe('isUsOptionsRegularSession — weekday in regular session (EST)', () => {
    it('returns true at 09:30 ET (opening boundary)', () => {
        // 2026-12-15 Tue. 09:30 EST = 14:30 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T14:30:00Z'))
        ).toBe(true);
    });

    it('returns true at 16:00 ET (closing boundary, inclusive)', () => {
        // 2026-12-15 Tue. 16:00 EST = 21:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T21:00:00Z'))
        ).toBe(true);
    });

    it('returns true at 12:00 ET (midday)', () => {
        // 2026-12-15 Tue. 12:00 EST = 17:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T17:00:00Z'))
        ).toBe(true);
    });
});

describe('isUsOptionsRegularSession — weekday out of regular session', () => {
    it('returns false at 09:29 ET (one minute before open, EDT)', () => {
        // 2026-05-20 Wed. 09:29 EDT = 13:29 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T13:29:00Z'))
        ).toBe(false);
    });

    it('returns false at 16:01 ET (one minute after close, EDT)', () => {
        // 2026-05-20 Wed. 16:01 EDT = 20:01 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T20:01:00Z'))
        ).toBe(false);
    });

    it('returns false at 03:00 ET (pre-market, EDT)', () => {
        // 2026-05-20 Wed. 03:00 EDT = 07:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T07:00:00Z'))
        ).toBe(false);
    });

    it('returns false at 09:29 ET (one minute before open, EST)', () => {
        // 2026-12-15 Tue. 09:29 EST = 14:29 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T14:29:00Z'))
        ).toBe(false);
    });

    it('returns false at 16:01 ET (one minute after close, EST)', () => {
        // 2026-12-15 Tue. 16:01 EST = 21:01 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T21:01:00Z'))
        ).toBe(false);
    });

    it('returns false at 03:00 ET (pre-market, EST)', () => {
        // 2026-12-15 Tue. 03:00 EST = 08:00 UTC.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T08:00:00Z'))
        ).toBe(false);
    });
});

describe('isUsOptionsRegularSession — DST correctness', () => {
    it('treats 13:30 UTC as in-session during EDT (= 09:30 ET)', () => {
        // EDT period (UTC-4): 13:30 UTC → 09:30 ET → in-session.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T13:30:00Z'))
        ).toBe(true);
    });

    it('treats 13:30 UTC as OUT-of-session during EST (= 08:30 ET)', () => {
        // EST period (UTC-5): 13:30 UTC → 08:30 ET → pre-market.
        // This proves the formatter is resolving the offset by calendar,
        // not by a hardcoded offset.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T13:30:00Z'))
        ).toBe(false);
    });

    it('treats 14:30 UTC as in-session during EST (= 09:30 ET)', () => {
        // EST period (UTC-5): 14:30 UTC → 09:30 ET → in-session.
        expect(
            isUsOptionsRegularSession(new Date('2026-12-15T14:30:00Z'))
        ).toBe(true);
    });

    it('treats 14:30 UTC as in-session during EDT (= 10:30 ET)', () => {
        // EDT period (UTC-4): 14:30 UTC → 10:30 ET → in-session.
        expect(
            isUsOptionsRegularSession(new Date('2026-05-20T14:30:00Z'))
        ).toBe(true);
    });
});

describe('hasAllZeroOpenInterest', () => {
    it('returns true when every call and put on every chain has OI = 0', () => {
        const snapshot = makeSnapshot([
            makeChain({
                calls: [makeContract({ openInterest: 0 })],
                puts: [makeContract({ openInterest: 0 })],
            }),
            makeChain({
                calls: [makeContract({ openInterest: 0 })],
                puts: [makeContract({ openInterest: 0 })],
            }),
        ]);
        expect(hasAllZeroOpenInterest(snapshot)).toBe(true);
    });

    it('returns false when a single call contract has nonzero OI', () => {
        const snapshot = makeSnapshot([
            makeChain({
                calls: [
                    makeContract({ openInterest: 0 }),
                    makeContract({ openInterest: 5 }),
                ],
                puts: [makeContract({ openInterest: 0 })],
            }),
        ]);
        expect(hasAllZeroOpenInterest(snapshot)).toBe(false);
    });

    it('returns false when a single put contract has nonzero OI', () => {
        const snapshot = makeSnapshot([
            makeChain({
                calls: [makeContract({ openInterest: 0 })],
                puts: [
                    makeContract({ openInterest: 0 }),
                    makeContract({ openInterest: 7 }),
                ],
            }),
        ]);
        expect(hasAllZeroOpenInterest(snapshot)).toBe(false);
    });

    it('returns true when chains is empty (vacuous truth of Array#every)', () => {
        // 코너 케이스: snapshot.chains.every(...)는 빈 배열에서 true를 반환한다.
        // 호출부(OptionsPageClient)는 정규장 외 시간과 AND로 묶고, snapshot이
        // 비어 있는 응답 자체가 정상 데이터가 아니므로 영향이 제한적이다.
        const snapshot = makeSnapshot([]);
        expect(hasAllZeroOpenInterest(snapshot)).toBe(true);
    });
});

describe('normalizeHour', () => {
    it('하루 종일의 정상 시간 값을 그대로 반환한다', () => {
        for (let h = 0; h <= 23; h++) expect(normalizeHour(h)).toBe(h);
    });
    it('ICU edge case로 24가 들어오면 0으로 정규화한다', () => {
        expect(normalizeHour(24)).toBe(0);
    });
});
