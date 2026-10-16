import { describe, expect, it } from 'vitest';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import {
    deriveFilingsStatus,
    deriveFtdStatus,
    deriveInstitutionalStatus,
    deriveShortStatus,
    deriveThresholdListStatus,
    isCollectingAndEmpty,
    maskUncollectedSections,
    resolveCollectingArms,
    UNKNOWN_PIPELINE_READINESS,
} from '../../lib/investorFlowsReadiness';
import { INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS } from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
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
    failsToDeliver: [],
    proposedSales: [],
    offerings: [],
    thresholdList: null,
};
const FTD = { settlementDate: '2026-09-20', failsQty: 50_000, price: 12 };
const SALE = {
    filingDate: '2026-10-01',
    filer: 'Officer',
    relationships: ['Officer'],
    shares: 1,
    valueUsd: 1,
    approxSaleDate: null,
    planAdoptionDate: null,
    url: 'https://www.sec.gov/x',
};
const OFFERING = {
    filingDate: '2026-09-01',
    form: 'S-3',
    kind: 'shelf' as const,
    url: 'https://www.sec.gov/y',
};
/** 모든 갈래가 준비된 상태 — 각 테스트가 한 갈래만 바꾼다. */
const READY: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
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
    failsToDeliver: 'collecting',
    filings: 'collecting',
    thresholdList: 'collecting',
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

describe('deriveFtdStatus', () => {
    it('is ready once any half-month file is stored, collecting before', () => {
        expect(deriveFtdStatus(true)).toBe('ready');
        expect(deriveFtdStatus(false)).toBe('collecting');
    });
});

describe('deriveFilingsStatus', () => {
    const today = '2026-10-16';
    it('is collecting before the first run (no cursor)', () => {
        expect(deriveFilingsStatus(null, today)).toBe('collecting');
    });

    it('is ready once the cursor is within the lag of today, collecting while it still trails', () => {
        const edge = addDays(today, -INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS);
        expect(deriveFilingsStatus(edge, today)).toBe('ready');
        expect(deriveFilingsStatus(addDays(edge, -1), today)).toBe(
            'collecting'
        );
    });
});

describe('deriveThresholdListStatus', () => {
    it('is unknown (not applicable) while the Reg SHO flag is off', () => {
        expect(
            deriveThresholdListStatus({
                regShoEnabled: false,
                hasIngestedDate: true,
            })
        ).toBe('unknown');
    });

    it('is collecting while enabled with no list yet, ready once one was ingested', () => {
        expect(
            deriveThresholdListStatus({
                regShoEnabled: true,
                hasIngestedDate: false,
            })
        ).toBe('collecting');
        expect(
            deriveThresholdListStatus({
                regShoEnabled: true,
                hasIngestedDate: true,
            })
        ).toBe('ready');
    });
});

describe('isCollectingAndEmpty', () => {
    it('is true only while collecting, enabled and every row list is empty', () => {
        expect(
            isCollectingAndEmpty('collecting', [[], null, undefined], true)
        ).toBe(true);
        expect(isCollectingAndEmpty('collecting', [[], [1]], true)).toBe(false);
        expect(isCollectingAndEmpty('ready', [[]], true)).toBe(false);
        expect(isCollectingAndEmpty('unknown', [[]], true)).toBe(false);
        expect(isCollectingAndEmpty('collecting', [[]], false)).toBe(false);
    });
});

describe('maskUncollectedSections', () => {
    it('turns empty short arrays into null ("unavailable") while FINRA is still collecting', () => {
        const masked = maskUncollectedSections(BASE, {
            ...READY,
            short: 'collecting',
        });
        expect(masked.shortInterest).toBeNull();
        expect(masked.shortVolume).toBeNull();
        expect(masked.institutional).toBe(BASE.institutional);
        expect(masked.failsToDeliver).toEqual([]);
    });

    it('turns an empty FTD list into null while FTD is still collecting', () => {
        const masked = maskUncollectedSections(BASE, {
            ...READY,
            failsToDeliver: 'collecting',
        });
        expect(masked.failsToDeliver).toBeNull();
        expect(masked.shortInterest).toEqual([]);
    });

    it('drops empty Form 144 / offering fields while filings are still collecting (core then scores neither)', () => {
        const masked = maskUncollectedSections(BASE, {
            ...READY,
            filings: 'collecting',
        });
        expect('proposedSales' in masked).toBe(false);
        expect('offerings' in masked).toBe(false);
    });

    it('keeps a filings field that already has rows while the other one is dropped', () => {
        const masked = maskUncollectedSections(
            { ...BASE, offerings: [OFFERING] },
            { ...READY, filings: 'collecting' }
        );
        expect(masked.offerings).toEqual([OFFERING]);
        expect('proposedSales' in masked).toBe(false);
    });

    it('returns the snapshot itself when ready or unknown', () => {
        expect(maskUncollectedSections(BASE, READY)).toBe(BASE);
        expect(maskUncollectedSections(BASE, UNKNOWN_PIPELINE_READINESS)).toBe(
            BASE
        );
    });

    it('returns the snapshot itself while collecting when every section already has rows', () => {
        const full = {
            ...BASE,
            shortInterest: [POINT],
            failsToDeliver: [FTD],
            proposedSales: [SALE],
            offerings: [OFFERING],
        };
        expect(maskUncollectedSections(full, collecting())).toBe(full);
    });

    it('leaves a FINRA-off snapshot (null already) untouched in its short fields', () => {
        const off = { ...BASE, shortInterest: null, shortVolume: null };
        const masked = maskUncollectedSections(off, {
            ...READY,
            short: 'collecting',
        });
        expect(masked.shortInterest).toBeNull();
        expect(masked.shortVolume).toBeNull();
    });
});

describe('resolveCollectingArms', () => {
    it('marks every empty section collecting when every arm is collecting', () => {
        expect(
            resolveCollectingArms({
                readiness: collecting(),
                snapshot: BASE,
                finraEnabled: true,
                regShoEnabled: true,
            })
        ).toEqual({
            institutional: true,
            short: true,
            failsToDeliver: true,
            proposedSales: true,
            offerings: true,
            thresholdList: true,
        });
    });

    it('never marks a section that already has data', () => {
        const arms = resolveCollectingArms({
            readiness: collecting(),
            snapshot: {
                ...BASE,
                failsToDeliver: [FTD],
                proposedSales: [SALE],
                offerings: [OFFERING],
                thresholdList: {
                    listed: false,
                    consecutiveDays: 0,
                    firstListedDate: null,
                    markets: [],
                    asOf: '2026-10-15',
                },
            },
            finraEnabled: true,
            regShoEnabled: true,
        });
        expect(arms.failsToDeliver).toBe(false);
        expect(arms.proposedSales).toBe(false);
        expect(arms.offerings).toBe(false);
        expect(arms.thresholdList).toBe(false);
    });

    it('does not mark FINRA collecting while the FINRA flag is off', () => {
        expect(
            resolveCollectingArms({
                readiness: collecting(),
                snapshot: BASE,
                finraEnabled: false,
                regShoEnabled: true,
            }).short
        ).toBe(false);
    });

    it('does not mark the threshold list collecting while the Reg SHO flag is off (a stale readiness cache cannot claim it)', () => {
        expect(
            resolveCollectingArms({
                readiness: collecting(),
                snapshot: BASE,
                finraEnabled: true,
                regShoEnabled: false,
            }).thresholdList
        ).toBe(false);
    });

    it('marks nothing when every arm is ready', () => {
        expect(
            Object.values(
                resolveCollectingArms({
                    readiness: READY,
                    snapshot: BASE,
                    finraEnabled: true,
                    regShoEnabled: true,
                })
            ).every(arm => !arm)
        ).toBe(true);
    });
});
