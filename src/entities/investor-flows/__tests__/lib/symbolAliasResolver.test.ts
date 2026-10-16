import { describe, expect, it } from 'vitest';
import { buildSymbolAliasResolver } from '../../lib/symbolAliasResolver';

// Universe uses OUR notation (dot or dash class separator).
const resolver = buildSymbolAliasResolver(['AAPL', 'BF.A', 'BF.B', 'BRK-B']);

describe('buildSymbolAliasResolver', () => {
    it('resolves exact matches case-insensitively', () => {
        expect(resolver('aapl')).toBe('AAPL');
    });

    it('resolves the slash form (FINRA CNMS) of a class share', () => {
        expect(resolver('BF/B')).toBe('BF.B');
    });

    it('resolves the compact form (FINRA short interest, SEC FTD) of a class share', () => {
        expect(resolver('BRKB')).toBe('BRK-B');
    });

    it.each(['BRK.B', 'BRK B', 'BRK/B', ' BRK-B '])(
        'resolves the exchange-list form %j',
        symbol => {
            expect(resolver(symbol)).toBe('BRK-B');
        }
    );

    it('maps a dash variant onto a dot universe symbol', () => {
        expect(resolver('BF-A')).toBe('BF.A');
    });

    it('returns null for symbols outside the universe', () => {
        expect(resolver('ZZZZ')).toBeNull();
    });

    it('lets an exact universe symbol win over another symbol’s alias', () => {
        const r = buildSymbolAliasResolver(['BF.A', 'BFA']);
        expect(r('BFA')).toBe('BFA');
    });
});
