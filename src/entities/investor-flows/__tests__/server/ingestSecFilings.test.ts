import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
    INVESTOR_FLOWS_FORM144_RETENTION_DAYS,
    INVESTOR_FLOWS_OFFERING_RETENTION_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
    INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import {
    SEC_FILINGS_CURSOR_OVERLAP_DAYS,
    runSecFilingsIngest,
    type IngestSecFilingsDeps,
    type IngestSecFilingsRepository,
} from '../../server/ingestSecFilings';
import type { FilingRetry, Form144Row, OfferingFilingRow } from '../../model';
import type { FilingsPruneCutoffs } from '../../api/investorFlowsFilingsRepository';
import {
    B5_UNDERWRITTEN_RECURSION,
    B5_ATM_HEARTSCIENCES,
    FORM144_AMD_NS2,
    FORM144_TRU_COM,
    FORM_INDEX_EXPANSION_EXCERPT,
} from '../fixtures/investorFlowsExpansionSamples';

const NOW = new Date('2026-10-16T12:00:00Z'); // Friday
const INDEX_DATE = '2026-10-15';
const AMD_ACC = '0001950047-26-010251';
const TEAM_ACC = '0001950047-26-010261';
const RXRX_ACC = '0001601830-26-000126';
const LEN_ACC = '0001193125-26-421862';
const NUBURU_ACC = '0001193125-26-423021';

/** Universe issuers of the real index excerpt (Atlassian's line is a reporting person whose Form 144 names another issuer). */
const CIK_SYMBOLS = new Map<number, string[]>([
    [2488, ['AMD']],
    [1650372, ['TEAM']],
    [1601830, ['RXRX']],
    [920760, ['LEN']],
    [1814215, ['NBRU']],
]);

interface Scenario {
    state?: Record<string, string>;
    /** state keys to leave unset (the defaults set the universe marker and a cursor) */
    unset?: string[];
    cikSymbols?: Map<number, string[]>;
    indexes?: Record<string, string>;
    /** primary_doc.xml per accession (default: AMD's real document) */
    form144Docs?: Record<string, string | Error>;
    /** 424B5 submission heads per accession (default: Recursion's real head) */
    heads?: Record<string, string | Error>;
    storedForm144?: string[];
    storedOfferings?: string[];
    failures?: Record<string, number>;
    retries?: FilingRetry[];
    exhausted?: number;
}

function build(
    scenario: Scenario = {},
    over: Partial<IngestSecFilingsDeps> = {}
) {
    const state = new Map<string, string>(
        Object.entries({
            [INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE]: 'done',
            [INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR]: '2026-10-14',
            ...scenario.state,
        }).filter(([key]) => !scenario.unset?.includes(key))
    );
    const calls = {
        indexDates: [] as string[],
        docs: [] as string[],
        heads: [] as string[],
        form144: [] as Form144Row[],
        offerings: [] as OfferingFilingRow[],
        failures: [] as { accession: string; error: string }[],
        skipped: [] as {
            accession: string;
            reason: string;
            maxAttempts: number;
        }[],
        prunes: [] as FilingsPruneCutoffs[],
        invalidated: [] as string[][],
        logs: [] as string[],
    };
    // a real database remembers what earlier runs stored or marked
    const storedForm144 = new Set(scenario.storedForm144 ?? []);
    const storedOfferings = new Set(scenario.storedOfferings ?? []);
    const failures = new Map(Object.entries(scenario.failures ?? {}));
    const repo: IngestSecFilingsRepository = {
        getState: async key => state.get(key) ?? null,
        setState: async (key, value) => {
            state.set(key, value);
        },
        loadCikSymbols: async () => scenario.cikSymbols ?? CIK_SYMBOLS,
        findStoredForm144: async accessions =>
            new Set(accessions.filter(a => storedForm144.has(a))),
        findStoredOfferings: async accessions =>
            new Set(accessions.filter(a => storedOfferings.has(a))),
        findFailureAttempts: async accessions =>
            new Map(
                accessions.flatMap(a =>
                    failures.has(a)
                        ? [[a, failures.get(a) as number] as const]
                        : []
                )
            ),
        upsertForm144: async rows => {
            calls.form144.push(...rows);
            for (const row of rows) storedForm144.add(row.accession);
        },
        upsertOfferings: async rows => {
            calls.offerings.push(...rows);
            for (const row of rows) storedOfferings.add(row.accession);
        },
        recordFailure: async (target, error) => {
            calls.failures.push({ accession: target.accession, error });
            failures.set(
                target.accession,
                (failures.get(target.accession) ?? 0) + 1
            );
        },
        recordSkipped: async (target, reason, maxAttempts) => {
            calls.skipped.push({
                accession: target.accession,
                reason,
                maxAttempts,
            });
            failures.set(target.accession, maxAttempts);
        },
        listRetries: async () => scenario.retries ?? [],
        countExhaustedFailures: async () => scenario.exhausted ?? 0,
        pruneBefore: async cutoffs => {
            calls.prunes.push(cutoffs);
            return { form144: 0, offerings: 0, failures: 0 };
        },
    };
    const deps: IngestSecFilingsDeps = {
        sec: {
            fetchDailyFormIndex: async date => {
                calls.indexDates.push(date);
                return (
                    (scenario.indexes ?? {
                        [INDEX_DATE]: FORM_INDEX_EXPANSION_EXCERPT,
                    })[date] ?? null
                );
            },
            fetchFilingDocumentText: async (cik, accession, fileName) => {
                calls.docs.push(`${cik}/${accession}/${fileName}`);
                const doc =
                    scenario.form144Docs?.[accession] ?? FORM144_AMD_NS2;
                if (doc instanceof Error) throw doc;
                return doc;
            },
            fetchFilingDocumentHead: async (cik, accession, fileName) => {
                calls.heads.push(`${cik}/${accession}/${fileName}`);
                const head =
                    scenario.heads?.[accession] ?? B5_UNDERWRITTEN_RECURSION;
                if (head instanceof Error) throw head;
                return head;
            },
        },
        repo,
        isSecBlockedError: error =>
            error instanceof Error && error.message === 'blocked',
        now: () => NOW,
        isDeadlineReached: () => false,
        invalidateSymbols: symbols => {
            calls.invalidated.push([...symbols]);
        },
        log: vi.fn((message: string) => {
            calls.logs.push(message);
        }),
        ...over,
    };
    return { deps, calls, state };
}

/** Real AMD/TRU docs per accession: AMD's names AMD as issuer, the Atlassian accession gets TRU's (an issuer outside the map). */
const DOCS = { [AMD_ACC]: FORM144_AMD_NS2, [TEAM_ACC]: FORM144_TRU_COM };

describe('runSecFilingsIngest', () => {
    describe('gates', () => {
        it('does nothing before cusip-map finished its first full pass', async () => {
            const { deps, calls } = build({
                unset: [INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE],
            });
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('universe_incomplete');
            expect(calls.indexDates).toEqual([]);
        });

        it('does nothing (and keeps the cursor) while the CIK map is empty', async () => {
            const { deps, calls, state } = build({ cikSymbols: new Map() });
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('cik_map_empty');
            expect(calls.indexDates).toEqual([]);
            expect(state.get(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR)).toBe(
                '2026-10-14'
            );
            expect(calls.logs[0]).toContain('[sec-filings] cik_map_empty');
        });
    });

    describe('cursor', () => {
        it('starts CURSOR_OVERLAP_DAYS before the stored cursor and skips weekends', async () => {
            const { deps, calls } = build();
            const result = await runSecFilingsIngest(deps);
            expect(result.startDate).toBe(
                addDays('2026-10-14', -SEC_FILINGS_CURSOR_OVERLAP_DAYS)
            );
            expect(calls.indexDates).toEqual([
                '2026-10-12',
                '2026-10-13',
                '2026-10-14',
                '2026-10-15',
                '2026-10-16',
            ]);
        });

        it('backfills from today − 180 days when there is no cursor', async () => {
            const { deps, calls } = build({
                unset: [INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR],
            });
            const result = await runSecFilingsIngest(deps);
            const start = addDays(
                '2026-10-16',
                -INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS
            );
            expect(result.startDate).toBe(start);
            // 2026-04-19 is a Sunday — the first index read is the Monday after
            expect(calls.indexDates[0]).toBe(addDays(start, 1));
        });

        it('moves the cursor to the last day whose index existed, not to a missing (unpublished) day', async () => {
            const { deps, state } = build();
            const result = await runSecFilingsIngest(deps);
            expect(result.cursor).toBe(INDEX_DATE);
            expect(state.get(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR)).toBe(
                INDEX_DATE
            );
        });
    });

    describe('one real daily index', () => {
        it('downloads each universe Form 144 once (issuer + reporter lines merge) from primary_doc.xml', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            await runSecFilingsIngest(deps);
            expect(calls.docs.sort()).toEqual([
                `0000002488/${AMD_ACC}/primary_doc.xml`,
                `0001650372/${TEAM_ACC}/primary_doc.xml`,
            ]);
        });

        it('stores the AMD Form 144 under its issuer CIK and symbol', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            await runSecFilingsIngest(deps);
            expect(calls.form144).toEqual([
                {
                    accession: AMD_ACC,
                    issuerCik: 2488,
                    symbol: 'AMD',
                    filerName: 'FORREST E NORROD',
                    relationships: ['Officer'],
                    securityClass: 'Common',
                    shares: 17262,
                    valueUsd: 9333573,
                    sharesOutstanding: 1632475042,
                    approxSaleDate: '2026-10-15',
                    planAdoptionDate: '2026-05-20',
                    broker: 'Morgan Stanley Smith Barney LLC Executive Financial Services',
                    formType: '144',
                    filingDate: INDEX_DATE,
                },
            ]);
        });

        it('stores nothing (and records no failure) when the document names an issuer outside the CIK map', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            await runSecFilingsIngest(deps);
            expect(calls.form144.some(r => r.accession === TEAM_ACC)).toBe(
                false
            );
            expect(calls.failures).toEqual([]);
        });

        it('leaves a durable negative marker for that accession instead', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            const result = await runSecFilingsIngest(deps);
            expect(calls.skipped).toEqual([
                {
                    accession: TEAM_ACC,
                    reason: 'issuer CIK 1552033 is outside the universe',
                    maxAttempts: INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
                },
            ]);
            expect(result.documentsSkipped).toBe(1);
        });

        it('makes no document request on a second run over the same days (stored and skipped accessions)', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            await runSecFilingsIngest(deps);
            const first = calls.docs.length + calls.heads.length;
            await runSecFilingsIngest(deps);
            expect(first).toBe(4);
            expect(calls.docs.length + calls.heads.length).toBe(first);
        });

        it('classifies a universe 424B5 from the head of its submission .txt', async () => {
            const { deps, calls } = build({
                heads: { [LEN_ACC]: B5_ATM_HEARTSCIENCES },
            });
            await runSecFilingsIngest(deps);
            expect(calls.heads.sort()).toEqual([
                `0000920760/${LEN_ACC}/${LEN_ACC}.txt`,
                `0001601830/${RXRX_ACC}/${RXRX_ACC}.txt`,
            ]);
            expect(
                calls.offerings
                    .filter(o => o.formType === '424B5')
                    .map(o => `${o.symbol}:${o.kind}`)
                    .sort()
            ).toEqual(['LEN:atm', 'RXRX:underwritten']);
        });

        it('stores a shelf registration from the form alone, without any document request', async () => {
            const { deps, calls } = build();
            await runSecFilingsIngest(deps);
            expect(
                calls.offerings.find(o => o.accession === NUBURU_ACC)
            ).toEqual({
                accession: NUBURU_ACC,
                symbol: 'NBRU',
                issuerCik: 1814215,
                formType: 'S-3',
                filingDate: INDEX_DATE,
                kind: 'shelf',
                url: `https://www.sec.gov/Archives/edgar/data/1814215/000119312526423021/${NUBURU_ACC}-index.htm`,
            });
            expect(calls.heads.some(h => h.includes(NUBURU_ACC))).toBe(false);
        });

        it('invalidates the symbols that got new filings', async () => {
            const { deps, calls } = build({ form144Docs: DOCS });
            const result = await runSecFilingsIngest(deps);
            expect(calls.invalidated).toEqual([['AMD', 'LEN', 'NBRU', 'RXRX']]);
            expect(result.invalidated).toBe(4);
        });
    });

    describe('idempotency and retries', () => {
        it('does not re-download stored accessions', async () => {
            const { deps, calls } = build({
                storedForm144: [AMD_ACC, TEAM_ACC],
                storedOfferings: [RXRX_ACC, LEN_ACC, NUBURU_ACC],
            });
            await runSecFilingsIngest(deps);
            expect(calls.docs).toEqual([]);
            expect(calls.heads).toEqual([]);
            expect(calls.offerings).toEqual([]);
        });

        it('skips a document whose attempts are exhausted', async () => {
            const { deps, calls } = build({
                failures: {
                    [AMD_ACC]: INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
                    [RXRX_ACC]: INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
                },
            });
            await runSecFilingsIngest(deps);
            expect(calls.docs.some(d => d.includes(AMD_ACC))).toBe(false);
            expect(calls.heads.some(h => h.includes(RXRX_ACC))).toBe(false);
        });

        it('retries a document with attempts left', async () => {
            const { deps, calls } = build({
                failures: {
                    [AMD_ACC]: INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS - 1,
                },
            });
            await runSecFilingsIngest(deps);
            expect(calls.docs.some(d => d.includes(AMD_ACC))).toBe(true);
        });

        it('records a failed document and still advances the cursor (the retry queue owns it now)', async () => {
            const { deps, calls, state } = build({
                form144Docs: {
                    [AMD_ACC]: new Error('timeout'),
                    [TEAM_ACC]: FORM144_TRU_COM,
                },
            });
            const result = await runSecFilingsIngest(deps);
            expect(calls.failures).toEqual([
                { accession: AMD_ACC, error: 'timeout' },
            ]);
            expect(result.documentsFailed).toBe(1);
            expect(state.get(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR)).toBe(
                INDEX_DATE
            );
        });

        it('records an unparseable Form 144 as a failure', async () => {
            const { deps, calls } = build({
                form144Docs: {
                    [AMD_ACC]: '<edgarSubmission/>',
                    [TEAM_ACC]: FORM144_TRU_COM,
                },
            });
            await runSecFilingsIngest(deps);
            expect(calls.failures).toEqual([
                { accession: AMD_ACC, error: 'Form 144 document unparseable' },
            ]);
        });

        it('re-tries queued documents outside the scanned days through their stored CIK', async () => {
            const { deps, calls } = build({
                indexes: {},
                retries: [
                    {
                        accession: 'OLD-144',
                        cik: '0000002488',
                        formType: '144',
                        filingDate: '2026-05-01',
                        attempts: 1,
                    },
                    {
                        accession: 'OLD-B5',
                        cik: '0001601830',
                        formType: '424B5',
                        filingDate: '2026-05-01',
                        attempts: 2,
                    },
                    {
                        accession: 'GONE-B5',
                        cik: '0000099999',
                        formType: '424B5',
                        filingDate: '2026-05-01',
                        attempts: 1,
                    },
                ],
            });
            const result = await runSecFilingsIngest(deps);
            expect(result.retried).toBe(3);
            expect(calls.docs).toEqual(['0000002488/OLD-144/primary_doc.xml']);
            // the issuer that left the universe is not fetched again
            expect(calls.heads).toEqual(['0001601830/OLD-B5/OLD-B5.txt']);
            expect(calls.offerings).toEqual([
                expect.objectContaining({
                    accession: 'OLD-B5',
                    symbol: 'RXRX',
                    kind: 'underwritten',
                }),
            ]);
        });
    });

    describe('stops', () => {
        it('stops before a new day once the deadline passed', async () => {
            const { deps, calls } = build(
                {},
                { isDeadlineReached: () => true }
            );
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('deadline');
            expect(calls.indexDates).toEqual([]);
        });

        it('stops at a SEC block on the index, without pruning', async () => {
            const { deps, calls } = build(
                {},
                {
                    sec: {
                        ...build().deps.sec,
                        fetchDailyFormIndex: async () => {
                            throw new Error('blocked');
                        },
                    },
                }
            );
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('sec_blocked');
            expect(calls.prunes).toEqual([]);
            expect(calls.logs).toContain(
                '[sec-filings] sec_blocked — SEC refused the request, stopping'
            );
        });

        it('stops at a SEC block on a document, keeps what was downloaded and leaves the cursor on that day', async () => {
            const { deps, calls, state } = build({
                form144Docs: {
                    [AMD_ACC]: FORM144_AMD_NS2,
                    [TEAM_ACC]: new Error('blocked'),
                },
            });
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('sec_blocked');
            expect(calls.form144.map(r => r.accession)).toEqual([AMD_ACC]);
            expect(calls.failures).toEqual([]);
            expect(state.get(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR)).toBe(
                '2026-10-14'
            );
        });

        it('does not start the next document wave after the deadline (the day is redone next run)', async () => {
            let checks = 0;
            const { deps, calls, state } = build(
                { form144Docs: DOCS },
                // the date loop's check passes, the document waves see the deadline
                { isDeadlineReached: () => ++checks > 1 }
            );
            const result = await runSecFilingsIngest(deps);
            expect(result.stoppedBy).toBe('deadline');
            expect(calls.docs).toEqual([]);
            expect(state.get(INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR)).toBe(
                '2026-10-14'
            );
        });
    });

    describe('housekeeping', () => {
        it('prunes once a day with the Form 144 / offering retention', async () => {
            const { deps, calls, state } = build();
            await runSecFilingsIngest(deps);
            await runSecFilingsIngest(deps);
            expect(calls.prunes).toEqual([
                {
                    form144Before: addDays(
                        '2026-10-16',
                        -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
                    ),
                    offeringsBefore: addDays(
                        '2026-10-16',
                        -INVESTOR_FLOWS_OFFERING_RETENTION_DAYS
                    ),
                    failuresBefore: addDays(
                        '2026-10-16',
                        -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
                    ),
                },
            ]);
            expect(state.get('sec_filings_prune_day')).toBe('2026-10-16');
        });

        it('logs a backlog line once permanently failed documents pile up', async () => {
            const { deps, calls } = build({
                exhausted: INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
            });
            await runSecFilingsIngest(deps);
            expect(calls.logs).toContain(
                `[sec-filings] backlog of permanently failed documents: ${INVESTOR_FLOWS_FAILED_BACKLOG_ALERT}`
            );
        });
    });
});
