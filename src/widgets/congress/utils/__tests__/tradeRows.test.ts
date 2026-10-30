import { MAX_ROWS, limitRows } from '../tradeRows';

const make = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('limitRows', () => {
    it('keeps everything at the limit', () => {
        const r = limitRows(make(MAX_ROWS));
        expect(r.rows).toHaveLength(MAX_ROWS);
        expect(r.truncated).toBe(false);
    });

    it('keeps the first MAX_ROWS and reports the total when over the limit', () => {
        const r = limitRows(make(MAX_ROWS + 5));
        expect(r.rows).toEqual(make(MAX_ROWS));
        expect(r.total).toBe(MAX_ROWS + 5);
        expect(r.truncated).toBe(true);
    });
});
