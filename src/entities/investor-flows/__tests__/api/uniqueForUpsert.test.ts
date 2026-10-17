import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uniqueForUpsert } from '../../api/uniqueForUpsert';
import { compositeKey } from '../../lib/dedupeByKey';

type Row = { symbol: string; tradeDate: string; shortVolume: number };
const keyOf = (row: Row): string => compositeKey(row.symbol, row.tradeDate);

describe('uniqueForUpsert', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
    });

    describe('when the conflict keys are unique', () => {
        it('returns the rows and does not warn', () => {
            const rows = [
                { symbol: 'AAPL', tradeDate: '2026-10-15', shortVolume: 10 },
                { symbol: 'AAPL', tradeDate: '2026-10-16', shortVolume: 20 },
            ];
            expect(uniqueForUpsert('finra_short_volume', rows, keyOf)).toEqual(
                rows
            );
            expect(warn).not.toHaveBeenCalled();
        });
    });

    describe('when a conflict key repeats', () => {
        const rows = [
            { symbol: 'BRK-B', tradeDate: '2026-10-16', shortVolume: 10 },
            { symbol: 'BRK-B', tradeDate: '2026-10-16', shortVolume: 30 },
        ];

        it('keeps the last row of the key', () => {
            expect(uniqueForUpsert('finra_short_volume', rows, keyOf)).toEqual([
                { symbol: 'BRK-B', tradeDate: '2026-10-16', shortVolume: 30 },
            ]);
        });

        it('warns once with the table, the dropped count and the readable key', () => {
            uniqueForUpsert('finra_short_volume', rows, keyOf);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'finra_short_volume: dropped 1 duplicate-key row(s)'
                ),
                ['BRK-B|2026-10-16']
            );
        });
    });

    describe('when a logger is injected', () => {
        const rows = [
            { symbol: 'BRK-B', tradeDate: '2026-10-16', shortVolume: 10 },
            { symbol: 'BRK-B', tradeDate: '2026-10-16', shortVolume: 30 },
        ];

        it('warns through that logger instead of the console', () => {
            const log = vi.fn();
            uniqueForUpsert('finra_short_volume', rows, keyOf, log);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                expect.stringContaining(
                    'finra_short_volume: dropped 1 duplicate-key row(s)'
                ),
                ['BRK-B|2026-10-16']
            );
            expect(warn).not.toHaveBeenCalled();
        });

        it('does not call the logger when nothing is dropped', () => {
            const log = vi.fn();
            uniqueForUpsert('finra_short_volume', rows.slice(0, 1), keyOf, log);
            expect(log).not.toHaveBeenCalled();
        });
    });
});
