/**
 * Unit tests for isOpenInterestSnapshotStale.
 *
 * The heuristic flags an options snapshot as stale when the fraction of
 * zero-OI contracts meets or exceeds OI_STALE_FRACTION_THRESHOLD. We exercise
 * the threshold boundary (just at / just below), the all-zero and empty cases,
 * a realistic PRE-PRE distribution, and the calls+puts aggregation.
 */

import {
    isOpenInterestSnapshotStale,
    OI_STALE_FRACTION_THRESHOLD,
} from '@/shared/lib/options/openInterestStale';
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
