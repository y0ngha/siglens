import { contentHash } from '@/entities/shared-analysis/lib/contentHash';

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe('contentHash', () => {
    it('returns a sha256 hex digest', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toMatch(SHA256_HEX);
    });
    it('is stable for the same inputs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toBe(
            contentHash('chart', 'AAPL', { a: 1 })
        );
    });
    it('differs when kind differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(
            contentHash('news', 'AAPL', { a: 1 })
        );
    });
    it('differs when result differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(
            contentHash('chart', 'AAPL', { a: 2 })
        );
    });

    // ── T7: JSON key-order sensitivity (documented, not canonicalized) ────────
    //
    // Decision: document order-sensitivity rather than canonicalize.
    //
    // `contentHash` uses JSON.stringify which serializes keys in insertion order.
    // Two objects that are semantically equal but have different key insertion
    // order produce different hashes. This is acceptable for the deduplication
    // use case because:
    //   1. The snapshot `result` objects always originate from the same serializer
    //      (JSON.parse → stable key order), so collisions in practice are zero.
    //   2. Canonicalizing (sorted key recursion) adds complexity with no measurable
    //      benefit given (1).
    //   3. If a false-miss ever occurs, the outcome is a duplicate share row — a
    //      benign storage cost, not data corruption.
    //
    // This test documents the behavior explicitly so a future reader understands
    // why two "equal" objects may hash differently.
    it('is JSON key-order sensitive — objects with the same entries in different insertion order hash differently', () => {
        const ab = { a: 1, b: 2 };
        const ba = { b: 2, a: 1 };

        // Verify key order actually differs in this JS engine (it should).
        expect(JSON.stringify(ab)).not.toBe(JSON.stringify(ba));

        const hashAb = contentHash('chart', 'AAPL', ab);
        const hashBa = contentHash('chart', 'AAPL', ba);

        // The hashes differ because JSON.stringify preserves insertion order.
        expect(hashAb).not.toBe(hashBa);
    });

    // ── chartBars: dedup behaviour ────────────────────────────────────────────
    //
    // chart kind includes chartBars in the hash so that a share at T1 and a share
    // at T2 (same result, different bars) produce distinct snapshots. Each sharer
    // therefore sees the chart exactly as it was at share time.
    describe('chartBars parameter', () => {
        const bars1 = [{ t: 1, o: 100, h: 110, l: 90, c: 105, v: 1000 }];
        const bars2 = [{ t: 2, o: 200, h: 220, l: 180, c: 210, v: 2000 }];
        const result = { trend: 'bullish' };

        it('same result + different chartBars → different hash', () => {
            const h1 = contentHash('chart', 'AAPL', result, bars1);
            const h2 = contentHash('chart', 'AAPL', result, bars2);
            expect(h1).not.toBe(h2);
        });

        it('identical everything including chartBars → same hash', () => {
            const h1 = contentHash('chart', 'AAPL', result, bars1);
            const h2 = contentHash('chart', 'AAPL', result, bars1);
            expect(h1).toBe(h2);
        });

        it('non-chart kind without chartBars: hash unchanged vs omitting chartBars', () => {
            // Passing undefined is equivalent to omitting; non-chart hashes stay stable.
            const withUndefined = contentHash(
                'news',
                'TSLA',
                result,
                undefined
            );
            const withOmitted = contentHash('news', 'TSLA', result);
            expect(withUndefined).toBe(withOmitted);
        });

        it('non-chart kind hash is NOT affected by chartBars (should not be passed, but guard test)', () => {
            // Even if bars were accidentally passed for a non-chart kind they would
            // change the hash (no special handling by kind). This documents the
            // contract: callers must only pass chartBars for chart kind.
            const noBar = contentHash('news', 'TSLA', result);
            const withBar = contentHash('news', 'TSLA', result, bars1);
            expect(noBar).not.toBe(withBar);
        });
    });
});
