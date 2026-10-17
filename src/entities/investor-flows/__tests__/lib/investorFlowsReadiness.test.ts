import { describe, expect, it } from 'vitest';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import {
    deriveDartStatus,
    deriveFilingsStatus,
    deriveFtdStatus,
    deriveInstitutionalStatus,
    deriveShortStatus,
    deriveThresholdListStatus,
    isCollectingAggregate,
    isCollectingAndEmpty,
    isKrDisclosureCollecting,
    maskUncollectedSections,
    resolveCollectingArms,
    UNKNOWN_PIPELINE_READINESS,
} from '../../lib/investorFlowsReadiness';
import { INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS } from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import type { InvestorFlowsPipelineReadiness } from '../../model';
import { makeSnapshot } from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';

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
    dart: 'ready',
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
    dart: 'collecting',
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
    const settled = { universeComplete: true, rebackfillPending: false };

    it('is unknown (not applicable) while the FINRA flag is off, whatever the tables hold', () => {
        expect(
            deriveShortStatus({
                finraEnabled: false,
                hasAnyRow: true,
                ...settled,
            })
        ).toBe('unknown');
        expect(
            deriveShortStatus({
                finraEnabled: false,
                hasAnyRow: false,
                universeComplete: false,
                rebackfillPending: true,
            })
        ).toBe('unknown');
    });

    it('is collecting while enabled but empty, ready once any row exists and the universe has settled', () => {
        expect(
            deriveShortStatus({
                finraEnabled: true,
                hasAnyRow: false,
                ...settled,
            })
        ).toBe('collecting');
        expect(
            deriveShortStatus({
                finraEnabled: true,
                hasAnyRow: true,
                ...settled,
            })
        ).toBe('ready');
    });

    it('stays collecting while the CUSIP universe is incomplete, even with rows (symbols mapped later have none yet)', () => {
        expect(
            deriveShortStatus({
                finraEnabled: true,
                hasAnyRow: true,
                universeComplete: false,
                rebackfillPending: false,
            })
        ).toBe('collecting');
    });

    it('stays collecting until the one-time FINRA re-ingest has cleared its request', () => {
        expect(
            deriveShortStatus({
                finraEnabled: true,
                hasAnyRow: true,
                universeComplete: true,
                rebackfillPending: true,
            })
        ).toBe('collecting');
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

describe('isCollectingAggregate', () => {
    it.each([
        ['collecting', true],
        ['ready', false],
        ['unknown', false],
    ] as const)('%s → %s, regardless of rows', (status, expected) => {
        expect(isCollectingAggregate(status)).toBe(expected);
    });
});

/** A partially aggregated 13F section (quarters, top holders and options present). */
const PARTIAL_INSTITUTIONAL = makeSnapshot().institutional;

describe('maskUncollectedSections', () => {
    it('empties a 13F section that already has (partial) rows while 13F is still collecting', () => {
        const masked = maskUncollectedSections(
            { ...BASE, institutional: PARTIAL_INSTITUTIONAL },
            { ...READY, institutional: 'collecting' }
        );
        expect(masked.institutional).toEqual({
            quarters: [],
            topHolders: [],
            topHoldersPeriod: null,
        });
    });

    it('keeps the 13F rows once 13F is ready', () => {
        const snapshot = { ...BASE, institutional: PARTIAL_INSTITUTIONAL };
        expect(maskUncollectedSections(snapshot, READY)).toBe(snapshot);
    });

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
        expect(
            maskUncollectedSections(
                full,
                collecting({ institutional: 'ready' })
            )
        ).toBe(full);
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

    it('marks 13F collecting even when it already has (partial) rows', () => {
        expect(
            resolveCollectingArms({
                readiness: { ...READY, institutional: 'collecting' },
                snapshot: { ...BASE, institutional: PARTIAL_INSTITUTIONAL },
                finraEnabled: true,
                regShoEnabled: true,
            }).institutional
        ).toBe(true);
    });

    it('does not mark 13F collecting when its readiness is unknown', () => {
        expect(
            resolveCollectingArms({
                readiness: UNKNOWN_PIPELINE_READINESS,
                snapshot: BASE,
                finraEnabled: true,
                regShoEnabled: true,
            }).institutional
        ).toBe(false);
    });

    it('never marks a row-level section that already has data', () => {
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

describe('deriveDartStatus', () => {
    it('is unknown without a DART key (never "collecting" — the page says no data)', () => {
        expect(
            deriveDartStatus({ dartEnabled: false, backfillDone: false })
        ).toBe('unknown');
        expect(
            deriveDartStatus({ dartEnabled: false, backfillDone: true })
        ).toBe('unknown');
    });

    it('is collecting with a key until the backfill marker exists, then ready', () => {
        expect(
            deriveDartStatus({ dartEnabled: true, backfillDone: false })
        ).toBe('collecting');
        expect(
            deriveDartStatus({ dartEnabled: true, backfillDone: true })
        ).toBe('ready');
    });
});

describe('isKrDisclosureCollecting', () => {
    const KR_SNAPSHOT: InvestorFlowsSnapshot = {
        ...BASE,
        market: 'kr',
        kr: {
            majorHolders: [],
            insiders: [],
            tradingPlans: [
                {
                    receiptDate: '2026-10-14',
                    reporter: '이임원',
                    title: '거래계획',
                    url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1',
                },
            ],
        },
    };

    it('is true only while DART is collecting and the stock has no reports (null snapshot counts as empty)', () => {
        expect(
            isKrDisclosureCollecting({ ...READY, dart: 'collecting' }, null)
        ).toBe(true);
        expect(
            isKrDisclosureCollecting(
                { ...READY, dart: 'collecting' },
                KR_SNAPSHOT
            )
        ).toBe(false);
    });

    it('ignores the US branches — 13F and FINRA collecting do not make a Korean page collecting', () => {
        expect(
            isKrDisclosureCollecting(
                {
                    ...READY,
                    institutional: 'collecting',
                    short: 'collecting',
                    dart: 'ready',
                },
                null
            )
        ).toBe(false);
    });

    it('is false when DART readiness is unknown (no key or unreadable state)', () => {
        expect(
            isKrDisclosureCollecting({ ...READY, dart: 'unknown' }, null)
        ).toBe(false);
    });
});
