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
    etParts,
    getEtSessionStatus,
    isOpenInterestSnapshotStale,
    isUsOptionsRegularSession,
    lookupWeekday,
    MARKET_CLOSE_HOUR,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    normalizeHour,
    OI_STALE_FRACTION_THRESHOLD,
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
        // 2026-05-20 Wed. EDT: UTC = ET + 4h. 상수 기반 파생으로 hardcoded
        // boundary 값이 session.ts와 어긋날 가능성을 차단.
        const edtOpenUtcHour = MARKET_OPEN_HOUR + 4;
        const edtOpenUtcDate = new Date(
            `2026-05-20T${String(edtOpenUtcHour).padStart(2, '0')}:${String(
                MARKET_OPEN_MINUTE
            ).padStart(2, '0')}:00Z`
        );
        expect(isUsOptionsRegularSession(edtOpenUtcDate)).toBe(true);
    });

    it('returns true at 16:00 ET (closing boundary, inclusive)', () => {
        // 2026-05-20 Wed. EDT: UTC = ET + 4h. 상수 기반 파생으로 hardcoded
        // boundary 값이 session.ts와 어긋날 가능성을 차단. 마감은 정각이라
        // 분은 인라인 '00' 유지.
        const edtCloseUtcHour = MARKET_CLOSE_HOUR + 4;
        const edtCloseUtcDate = new Date(
            `2026-05-20T${String(edtCloseUtcHour).padStart(2, '0')}:00:00Z`
        );
        expect(isUsOptionsRegularSession(edtCloseUtcDate)).toBe(true);
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
        // 2026-12-15 Tue. EST: UTC = ET + 5h. 상수 기반 파생으로 hardcoded
        // boundary 값이 session.ts와 어긋날 가능성을 차단.
        const estOpenUtcHour = MARKET_OPEN_HOUR + 5;
        const estOpenUtcDate = new Date(
            `2026-12-15T${String(estOpenUtcHour).padStart(2, '0')}:${String(
                MARKET_OPEN_MINUTE
            ).padStart(2, '0')}:00Z`
        );
        expect(isUsOptionsRegularSession(estOpenUtcDate)).toBe(true);
    });

    it('returns true at 16:00 ET (closing boundary, inclusive)', () => {
        // 2026-12-15 Tue. EST: UTC = ET + 5h. 상수 기반 파생으로 hardcoded
        // boundary 값이 session.ts와 어긋날 가능성을 차단. 마감은 정각이라
        // 분은 인라인 '00' 유지.
        const estCloseUtcHour = MARKET_CLOSE_HOUR + 5;
        const estCloseUtcDate = new Date(
            `2026-12-15T${String(estCloseUtcHour).padStart(2, '0')}:00:00Z`
        );
        expect(isUsOptionsRegularSession(estCloseUtcDate)).toBe(true);
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

describe('isOpenInterestSnapshotStale', () => {
    // 헬퍼: openInterest=0 / >0 를 원하는 개수만큼 섞은 단일 chain snapshot 생성.
    const buildSnapshotWith = (
        zeroCount: number,
        nonzeroCount: number
    ): OptionsSnapshot => {
        const calls: OptionsContract[] = [
            ...Array.from({ length: zeroCount }, () =>
                makeContract({ openInterest: 0 })
            ),
            ...Array.from({ length: nonzeroCount }, () =>
                makeContract({ openInterest: 100 })
            ),
        ];
        return makeSnapshot([makeChain({ calls, puts: [] })]);
    };

    it('returns true when zero-OI fraction equals the threshold boundary', () => {
        // 임계값이 바뀌어도 boundary가 자동 추적되도록 source 상수에서 파생한다.
        // total = 20 → zeros = ceil(20 * THRESHOLD) → 정확히 THRESHOLD 이상.
        const total = 20;
        const zeros = Math.ceil(total * OI_STALE_FRACTION_THRESHOLD);
        const snapshot = buildSnapshotWith(zeros, total - zeros);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(true);
    });

    it('returns false when zero-OI fraction is just below the threshold', () => {
        // boundary 바로 아래 비율: (zeros - 1) / total < THRESHOLD.
        const total = 20;
        const zeros = Math.ceil(total * OI_STALE_FRACTION_THRESHOLD) - 1;
        const snapshot = buildSnapshotWith(zeros, total - zeros);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(false);
    });

    it('returns true when every contract has OI = 0 (regression guard for original semantics)', () => {
        const snapshot = makeSnapshot([
            makeChain({
                calls: [
                    makeContract({ openInterest: 0 }),
                    makeContract({ openInterest: 0 }),
                ],
                puts: [
                    makeContract({ openInterest: 0 }),
                    makeContract({ openInterest: 0 }),
                ],
            }),
        ]);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(true);
    });

    it('returns true when there are no contracts at all (vacuous)', () => {
        // 코너 케이스: 빈 응답은 호출부(OptionsPageClient)가 정규장 외 시간과
        // AND로 묶기 때문에 정규장이 아니면서 응답이 비어 있는 비정상 경로이고,
        // 사용자에게 stale 안내를 보여주는 편이 안전하다.
        const snapshot = makeSnapshot([]);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(true);
    });

    it('returns true for the realistic PLTR PRE-PRE case (~99% stale)', () => {
        // 실측 PLTR PRE-PRE: 1252 contract 중 12개만 OI > 0 (즉 1240 zero).
        // 1240 / 1252 ≈ 0.9904 → stale.
        const snapshot = buildSnapshotWith(1240, 12);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(true);
    });

    it('counts calls and puts together when computing the fraction', () => {
        // 구현이 calls + puts 양쪽을 합산해 비율을 계산하는지 검증.
        // calls 10개(전부 zero) + puts 10개(전부 nonzero) → zero 비율 0.5 → stale 아님.
        // calls만 검사했다면 1.0이 나와 stale로 잘못 판정될 수 있음.
        const calls: OptionsContract[] = Array.from({ length: 10 }, () =>
            makeContract({ openInterest: 0 })
        );
        const puts: OptionsContract[] = Array.from({ length: 10 }, () =>
            makeContract({ openInterest: 100 })
        );
        const snapshot = makeSnapshot([makeChain({ calls, puts })]);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(false);
    });

    it('classifies a calls+puts mix at the threshold boundary as stale', () => {
        // calls/puts 혼합 boundary: 총 20개(calls 10 + puts 10) 중
        // ceil(20 * THRESHOLD)개가 zero이면 정확히 threshold 이상.
        const total = 20;
        const half = total / 2;
        const zerosTotal = Math.ceil(total * OI_STALE_FRACTION_THRESHOLD);
        // zero를 calls/puts에 나눠 배치 (calls가 더 많이 받음).
        const callZeros = Math.min(zerosTotal, half);
        const putZeros = zerosTotal - callZeros;
        const calls: OptionsContract[] = [
            ...Array.from({ length: callZeros }, () =>
                makeContract({ openInterest: 0 })
            ),
            ...Array.from({ length: half - callZeros }, () =>
                makeContract({ openInterest: 100 })
            ),
        ];
        const puts: OptionsContract[] = [
            ...Array.from({ length: putZeros }, () =>
                makeContract({ openInterest: 0 })
            ),
            ...Array.from({ length: half - putZeros }, () =>
                makeContract({ openInterest: 100 })
            ),
        ];
        const snapshot = makeSnapshot([makeChain({ calls, puts })]);
        expect(isOpenInterestSnapshotStale(snapshot)).toBe(true);
    });
});

describe('getEtSessionStatus', () => {
    it('주말 ET는 weekend를 반환한다', () => {
        // 2026-05-23 Saturday 09:30 EDT = 13:30 UTC.
        expect(getEtSessionStatus(new Date('2026-05-23T13:30:00Z'))).toBe(
            'weekend'
        );
    });
    it('평일 정규장 시간은 open을 반환한다', () => {
        // 2026-05-20 Wed 09:30 EDT = 13:30 UTC.
        expect(getEtSessionStatus(new Date('2026-05-20T13:30:00Z'))).toBe(
            'open'
        );
    });
    it('평일이지만 정규장 외 시간은 closed를 반환한다', () => {
        // 2026-05-20 Wed 03:00 EDT = 07:00 UTC.
        expect(getEtSessionStatus(new Date('2026-05-20T07:00:00Z'))).toBe(
            'closed'
        );
    });
});

describe('etParts', () => {
    it('EDT 기간: weekdayIndex/hour/minute를 정확히 반환한다', () => {
        // 2026-05-20 Wed 09:30 EDT = 13:30 UTC
        const result = etParts(new Date('2026-05-20T13:30:00Z'));
        expect(result).toEqual({ weekdayIndex: 3, hour: 9, minute: 30 });
    });
    it('EST 기간: DST 보정된 hour를 반환한다', () => {
        // 2026-12-15 Tue 09:30 EST = 14:30 UTC
        const result = etParts(new Date('2026-12-15T14:30:00Z'));
        expect(result).toEqual({ weekdayIndex: 2, hour: 9, minute: 30 });
    });
    it('토요일: weekdayIndex=6을 반환한다', () => {
        const result = etParts(new Date('2026-05-23T13:30:00Z'));
        expect(result.weekdayIndex).toBe(6);
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

describe('lookupWeekday', () => {
    it('인식된 요일 약어를 0(Sun)~6(Sat) 인덱스로 매핑한다', () => {
        expect(lookupWeekday('Sun')).toBe(0);
        expect(lookupWeekday('Mon')).toBe(1);
        expect(lookupWeekday('Sat')).toBe(6);
    });
    it('미인식 입력은 fallback 0을 반환한다', () => {
        expect(lookupWeekday('Xyz')).toBe(0);
        expect(lookupWeekday('')).toBe(0);
    });
});
