import { describe, expect, it } from 'vitest';
import {
    extractFtdFileLinks,
    ftdTrailerMatches,
    parseFtdFile,
    resolveFtdRows,
    type FtdUniverse,
} from '../../lib/ftdParser';
import { buildSymbolAliasResolver } from '../../lib/symbolAliasResolver';
import {
    FTD_EXCERPT_TOTAL,
    FTD_FILE_EXCERPT,
    FTD_LISTING_EXCERPT,
} from '../fixtures/investorFlowsExpansionSamples';

const BRK_B_CUSIP = '084670702';
const AAPL_CUSIP = '037833100';

describe('parseFtdFile', () => {
    describe('real excerpt of cnsfails202609b.txt', () => {
        const parsed = parseFtdFile(FTD_FILE_EXCERPT);

        it('reads every data row and the two trailer lines', () => {
            expect(parsed.rows).toHaveLength(10);
            expect(parsed.trailer).toEqual({
                recordCount: 10,
                totalQuantity: FTD_EXCERPT_TOTAL,
            });
        });

        it('parses settlement date, CUSIP, file symbol, quantity and price', () => {
            expect(parsed.rows[0]).toEqual({
                settlementDate: '2026-09-15',
                cusip: BRK_B_CUSIP,
                fileSymbol: 'BRKB',
                failsQty: 4357,
                price: 514.95,
            });
        });

        it('reads a `.` price as null', () => {
            expect(
                parsed.rows.find(r => r.fileSymbol === 'LVROF')?.price
            ).toBeNull();
        });

        it('reads an empty SYMBOL as null and keeps the row', () => {
            const ineligible = parsed.rows.find(r => r.cusip === '64990AYU3');
            expect(ineligible).toEqual({
                settlementDate: '2026-09-15',
                cusip: '64990AYU3',
                fileSymbol: null,
                failsQty: 10000,
                price: 1,
            });
        });

        it('matches its trailer (record count and total quantity)', () => {
            expect(ftdTrailerMatches(parsed)).toBe(true);
        });
    });

    describe('trailer validation', () => {
        const lines = FTD_FILE_EXCERPT.trimEnd().split('\n');

        it('rejects a file whose trailer is missing (a cut download)', () => {
            const cut = lines.slice(0, -2).join('\n');
            expect(ftdTrailerMatches(parseFtdFile(cut))).toBe(false);
        });

        it('rejects a file whose record count differs from the rows', () => {
            const dropped = [...lines.slice(0, 3), ...lines.slice(4)].join(
                '\n'
            );
            expect(ftdTrailerMatches(parseFtdFile(dropped))).toBe(false);
        });

        it('rejects a file whose total quantity differs', () => {
            const altered = FTD_FILE_EXCERPT.replace('|4357|', '|4358|');
            expect(ftdTrailerMatches(parseFtdFile(altered))).toBe(false);
        });

        it('rejects a file with a malformed data row even when counts line up', () => {
            const malformed = FTD_FILE_EXCERPT.replace(
                '20260915|B5950S113|MDXH|15436|',
                '2026-09-15|B5950S113|MDXH|15436|'
            );
            const parsed = parseFtdFile(malformed);
            expect(parsed.malformedLines).toBe(1);
            expect(ftdTrailerMatches(parsed)).toBe(false);
        });

        it('accepts CRLF line endings', () => {
            const crlf = parseFtdFile(
                FTD_FILE_EXCERPT.replaceAll('\n', '\r\n')
            );
            expect(ftdTrailerMatches(crlf)).toBe(true);
        });
    });
});

describe('resolveFtdRows', () => {
    const universe: FtdUniverse = {
        symbolByCusip: new Map([
            [BRK_B_CUSIP, 'BRK-B'],
            [AAPL_CUSIP, 'AAPL'],
        ]),
        cusipsBySymbol: new Map([
            ['BRK-B', [BRK_B_CUSIP]],
            ['AAPL', [AAPL_CUSIP]],
        ]),
        resolveSymbol: buildSymbolAliasResolver(['BRK-B', 'AAPL']),
    };
    const parsed = parseFtdFile(FTD_FILE_EXCERPT);

    it('keeps universe CUSIPs under OUR symbol, not the file symbol', () => {
        const rows = resolveFtdRows(parsed.rows, universe);
        expect(rows.map(r => `${r.symbol}@${r.settlementDate}`)).toEqual([
            'BRK-B@2026-09-15',
            'BRK-B@2026-09-17',
            'AAPL@2026-09-15',
            'AAPL@2026-09-16',
        ]);
    });

    it('drops an ETF whose file symbol only looks like a universe ticker (BRKC is not BRK-C)', () => {
        const rows = resolveFtdRows(parsed.rows, universe);
        expect(rows.some(r => r.cusip === '88634T832')).toBe(false);
    });

    it('accepts an unmapped CUSIP of the SAME issuer through the file symbol', () => {
        const newCusip = parsed.rows.map(r =>
            r.cusip === AAPL_CUSIP ? { ...r, cusip: '037833209' } : r
        );
        const rows = resolveFtdRows(newCusip, universe);
        expect(rows.filter(r => r.cusip === '037833209')).toHaveLength(2);
        expect(rows.find(r => r.cusip === '037833209')?.symbol).toBe('AAPL');
    });

    it('rejects an unmapped CUSIP of a DIFFERENT issuer even when the file symbol resolves', () => {
        const foreign = parsed.rows.map(r =>
            r.cusip === AAPL_CUSIP ? { ...r, cusip: '999999101' } : r
        );
        expect(
            resolveFtdRows(foreign, universe).some(r => r.cusip === '999999101')
        ).toBe(false);
    });

    it('keeps the first row of a repeated (CUSIP, settlement date)', () => {
        const [first] = parsed.rows;
        const rows = resolveFtdRows(
            [first!, { ...first!, failsQty: 1 }],
            universe
        );
        expect(rows).toEqual([
            {
                cusip: BRK_B_CUSIP,
                settlementDate: '2026-09-15',
                symbol: 'BRK-B',
                failsQty: 4357,
                price: 514.95,
            },
        ]);
    });
});

describe('extractFtdFileLinks', () => {
    const links = extractFtdFileLinks(FTD_LISTING_EXCERPT);

    it('reads links from every folder, newest key first', () => {
        expect(links.map(l => l.fileKey)).toEqual([
            '202609b',
            '202609a',
            '202605b',
            '202308b',
            '201706a',
        ]);
    });

    it('keeps the path as linked (other/ folder, `_0` suffix)', () => {
        expect(links.find(l => l.fileKey === '202308b')?.path).toBe(
            '/files/data/other/fails-deliver-data/cnsfails202308b_0.zip'
        );
    });

    it('uses the first link when a key appears twice', () => {
        const twice = `<a href="/files/data/fails-deliver-data/cnsfails202609b.zip">x</a><a href="/files/data/other/fails-deliver-data/cnsfails202609b.zip">y</a>`;
        expect(extractFtdFileLinks(twice)).toEqual([
            {
                fileKey: '202609b',
                path: '/files/data/fails-deliver-data/cnsfails202609b.zip',
            },
        ]);
    });

    it('ignores links that are not FTD half-month zips', () => {
        expect(
            extractFtdFileLinks(
                '<a href="/files/data/fails-deliver-data/cnsfails202613a.zip"></a><a href="/files/other.zip"></a>'
            )
        ).toEqual([]);
    });
});
