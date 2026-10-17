import { describe, expect, it } from 'vitest';
import {
    findContestedMappings,
    resolveCusipMapConflicts,
} from '../../lib/cusipMapConflicts';

type Row = { cusip: string; symbol: string; source: 'fmp' | 'openfigi' };
const row = (
    cusip: string,
    symbol: string,
    source: Row['source'] = 'fmp'
): Row => ({ cusip, symbol, source });

const SHARED = '084670702';
const NONE = new Map<string, string>();

describe('resolveCusipMapConflicts', () => {
    describe('when every CUSIP has one symbol', () => {
        it('returns the rows unchanged with no conflicts', () => {
            const rows = [row('037833100', 'AAPL'), row('594918104', 'MSFT')];
            expect(resolveCusipMapConflicts(rows, NONE)).toEqual({
                rows,
                conflicts: [],
            });
        });

        it('collapses the same (CUSIP, symbol) given twice to its last row, without a conflict', () => {
            expect(
                resolveCusipMapConflicts(
                    [
                        row(SHARED, 'BRK-B', 'fmp'),
                        row(SHARED, 'BRK-B', 'openfigi'),
                    ],
                    NONE
                )
            ).toEqual({
                rows: [row(SHARED, 'BRK-B', 'openfigi')],
                conflicts: [],
            });
        });
    });

    describe('when two symbols claim one CUSIP and the map has no live symbol for it', () => {
        it('keeps the lexicographically smallest symbol', () => {
            const { rows } = resolveCusipMapConflicts(
                [row(SHARED, 'XYZW'), row(SHARED, 'XYZ'), row(SHARED, 'XYZU')],
                NONE
            );
            expect(rows).toEqual([row(SHARED, 'XYZ')]);
        });

        it('reports the kept symbol and the dropped ones in sorted order', () => {
            const { conflicts } = resolveCusipMapConflicts(
                [row(SHARED, 'XYZW'), row(SHARED, 'XYZ'), row(SHARED, 'XYZU')],
                NONE
            );
            expect(conflicts).toEqual([
                { cusip: SHARED, kept: 'XYZ', dropped: ['XYZU', 'XYZW'] },
            ]);
        });

        it('gives the same answer whatever the input order', () => {
            const forward = resolveCusipMapConflicts(
                [row(SHARED, 'BRKB'), row(SHARED, 'BRK-B')],
                NONE
            );
            const backward = resolveCusipMapConflicts(
                [row(SHARED, 'BRK-B'), row(SHARED, 'BRKB')],
                NONE
            );
            expect(backward).toEqual(forward);
        });

        it('leaves the other CUSIPs of the input alone', () => {
            const { rows } = resolveCusipMapConflicts(
                [
                    row('037833100', 'AAPL'),
                    row(SHARED, 'BRKB'),
                    row(SHARED, 'BRK-B'),
                ],
                NONE
            );
            expect(rows).toEqual([
                row('037833100', 'AAPL'),
                row(SHARED, 'BRK-B'),
            ]);
        });
    });

    describe('when the map already holds the CUSIP under a live symbol', () => {
        const existing = new Map([[SHARED, 'BRKB']]);

        it('keeps the mapped symbol even if it is not the smallest', () => {
            const result = resolveCusipMapConflicts(
                [row(SHARED, 'BRK-B'), row(SHARED, 'BRKB')],
                existing
            );
            expect(result).toEqual({
                rows: [row(SHARED, 'BRKB')],
                conflicts: [
                    { cusip: SHARED, kept: 'BRKB', dropped: ['BRK-B'] },
                ],
            });
        });

        it('writes nothing for the CUSIP when the input lacks the mapped symbol', () => {
            const result = resolveCusipMapConflicts(
                [row(SHARED, 'BRK-B')],
                existing
            );
            expect(result).toEqual({
                rows: [],
                conflicts: [
                    { cusip: SHARED, kept: 'BRKB', dropped: ['BRK-B'] },
                ],
            });
        });

        it('reports no conflict when the input carries only the mapped symbol', () => {
            expect(
                resolveCusipMapConflicts([row(SHARED, 'BRKB')], existing)
            ).toEqual({ rows: [row(SHARED, 'BRKB')], conflicts: [] });
        });
    });
});

describe('findContestedMappings', () => {
    const mapped = (cusip: string, symbol: string) => ({ cusip, symbol });

    it('returns a mapping whose CUSIP another symbol claims', () => {
        expect(
            findContestedMappings(
                [row(SHARED, 'BRKB')],
                [mapped(SHARED, 'BRK-B')]
            )
        ).toEqual([mapped(SHARED, 'BRK-B')]);
    });

    it('ignores a mapping claimed only by its own symbol', () => {
        expect(
            findContestedMappings(
                [row(SHARED, 'BRK-B'), row(SHARED, 'BRK-B', 'openfigi')],
                [mapped(SHARED, 'BRK-B')]
            )
        ).toEqual([]);
    });

    it('returns a mapping when its own symbol and another one both claim the CUSIP', () => {
        expect(
            findContestedMappings(
                [row(SHARED, 'BRK-B'), row(SHARED, 'BRKB')],
                [mapped(SHARED, 'BRK-B')]
            )
        ).toEqual([mapped(SHARED, 'BRK-B')]);
    });

    it('ignores a mapping whose CUSIP no input row carries', () => {
        expect(
            findContestedMappings(
                [row('037833100', 'AAPL')],
                [mapped(SHARED, 'BRK-B')]
            )
        ).toEqual([]);
    });

    it('matches the row-by-row scan on a mixed input, in mapping order', () => {
        const rows = [
            row('A00000001', 'AAA'),
            row('B00000002', 'BBB'),
            row('B00000002', 'BBBW'),
            row('C00000003', 'CCC'),
            row('D00000004', 'DDD'),
        ];
        const existing = [
            mapped('D00000004', 'DDX'),
            mapped('A00000001', 'AAA'),
            mapped('B00000002', 'BBB'),
            mapped('C00000003', 'CCX'),
            mapped('E00000005', 'EEE'),
        ];
        const scanned = existing.filter(m =>
            rows.some(r => r.cusip === m.cusip && r.symbol !== m.symbol)
        );
        expect(findContestedMappings(rows, existing)).toEqual(scanned);
        expect(scanned).toEqual([
            mapped('D00000004', 'DDX'),
            mapped('B00000002', 'BBB'),
            mapped('C00000003', 'CCX'),
        ]);
    });
});
