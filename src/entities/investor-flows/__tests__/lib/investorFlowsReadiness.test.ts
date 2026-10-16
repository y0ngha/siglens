import { describe, expect, it } from 'vitest';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import {
    deriveInstitutionalStatus,
    deriveShortStatus,
    maskUncollectedShort,
    UNKNOWN_PIPELINE_READINESS,
} from '../../lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '../../model';

const BASE: InvestorFlowsSnapshot = {
    asOf: '2026-10-16T00:00:00.000Z',
    sharesOutstanding: 1e9,
    floatShares: 9e8,
    institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
    insider: { transactions: [] },
    largeHolders: [],
    shortInterest: [],
    shortVolume: [],
};
const POINT = {
    settlementDate: '2026-09-30',
    shortQty: 1,
    avgDailyVolume: null,
    daysToCover: null,
};
const collecting = (
    over: Partial<InvestorFlowsPipelineReadiness> = {}
): InvestorFlowsPipelineReadiness => ({
    institutional: 'collecting',
    short: 'collecting',
    ...over,
});

describe('deriveInstitutionalStatus', () => {
    it.each([
        [true, true, 'ready'],
        [true, false, 'collecting'],
        [false, true, 'collecting'],
        [false, false, 'collecting'],
    ] as const)(
        'universe=%s backfill=%s -> %s (both markers are required)',
        (universeComplete, backfillDone, expected) => {
            expect(
                deriveInstitutionalStatus({ universeComplete, backfillDone })
            ).toBe(expected);
        }
    );
});

describe('deriveShortStatus', () => {
    it('is unknown (not applicable) while the FINRA flag is off, whatever the tables hold', () => {
        expect(
            deriveShortStatus({ finraEnabled: false, hasAnyRow: true })
        ).toBe('unknown');
        expect(
            deriveShortStatus({ finraEnabled: false, hasAnyRow: false })
        ).toBe('unknown');
    });

    it('is collecting while enabled but empty, ready once any row exists', () => {
        expect(
            deriveShortStatus({ finraEnabled: true, hasAnyRow: false })
        ).toBe('collecting');
        expect(deriveShortStatus({ finraEnabled: true, hasAnyRow: true })).toBe(
            'ready'
        );
    });
});

describe('maskUncollectedShort', () => {
    it('turns empty short arrays into null ("unavailable") while FINRA is still collecting', () => {
        const masked = maskUncollectedShort(BASE, collecting());
        expect(masked.shortInterest).toBeNull();
        expect(masked.shortVolume).toBeNull();
        expect(masked.institutional).toBe(BASE.institutional);
    });

    it('keeps the arrays when ready, unknown, or when rows are already present', () => {
        expect(
            maskUncollectedShort(BASE, { ...collecting(), short: 'ready' })
        ).toBe(BASE);
        expect(maskUncollectedShort(BASE, UNKNOWN_PIPELINE_READINESS)).toBe(
            BASE
        );
        const withRows = { ...BASE, shortInterest: [POINT] };
        expect(maskUncollectedShort(withRows, collecting())).toBe(withRows);
    });

    it('leaves a FINRA-off snapshot (null already) untouched', () => {
        const off = { ...BASE, shortInterest: null, shortVolume: null };
        expect(maskUncollectedShort(off, collecting())).toEqual(off);
    });
});
