import { describe, expect, it, vi } from 'vitest';
import {
    DartApiError,
    DartQuotaError,
    dartFatalReason,
    type DartClient,
    type DartDisclosureDetailType,
    type DartListQuery,
    type DartRecord,
} from '@/shared/api/dart/dartClient';
import {
    createFakeDartClient,
    type FakeDartData,
} from '@/shared/api/dart/fakeDartClient';
import {
    parseDartBackfillCursor,
    parseDartListCursor,
} from '../../lib/dartIngestState';
import { addDays } from '../../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_MAX_ATTEMPTS,
    INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN,
    INVESTOR_FLOWS_DART_MAX_LIST_PAGES,
    INVESTOR_FLOWS_DART_RETENTION_DAYS,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_DART_LIST_CURSOR,
} from '../../lib/investorFlowsPolicy';
import { runDartFilingsIngest } from '../../server/ingestDartFilings';
import type { IngestDartFilingsDeps } from '../../server/ingestDartFilingsTypes';
import type {
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
} from '../../model';
import {
    EXECUTIVE_STOCK_LIST,
    MAJOR_STOCK_LIST,
    SAMSUNG_CORP,
    listRow,
} from '../fixtures/dartSamples';

/** 2026-10-16 10:00 KST. UTC 날짜도 같지만 KST 판정은 아래 별도 테스트가 고정한다. */
const NOW = new Date('2026-10-16T01:00:00Z');
const TODAY = '2026-10-16';
const HANWHA_CORP = '00160843';
const SK_CORP = '00164779';
/** 유니버스 밖 회사(티커 DB에 없다). */
const OUTSIDE_CORP = '00999999';

const CORP_BY_STOCK = new Map([
    ['005930', SAMSUNG_CORP],
    ['000880', HANWHA_CORP],
    ['000660', SK_CORP],
    ['999990', OUTSIDE_CORP],
]);
const SYMBOLS = [
    '005930.KS',
    '005935.KS',
    '000880.KS',
    '00088K.KS',
    '000660.KS',
    '069500.KS',
];

const majorFor = (corpCode: string): DartRecord[] =>
    MAJOR_STOCK_LIST.map(row => ({ ...row, corp_code: corpCode }));
const executiveFor = (corpCode: string): DartRecord[] =>
    EXECUTIVE_STOCK_LIST.map(row => ({ ...row, corp_code: corpCode }));

const DEFAULT_DATA: FakeDartData = {
    corpCodes: [],
    disclosures: {
        D001: [listRow({ report_nm: '주식등의대량보유상황보고서(일반)' })],
        D002: [
            listRow({
                rcept_no: '20261015000456',
                corp_code: HANWHA_CORP,
                stock_code: '000880',
            }),
            listRow({
                rcept_no: '20261015000457',
                corp_code: OUTSIDE_CORP,
                stock_code: '999990',
            }),
        ],
        D005: [
            listRow({
                rcept_no: '20261014000789',
                rcept_dt: '20261014',
                report_nm: '임원ㆍ주요주주특정증권등거래계획보고서',
                flr_nm: '이임원',
            }),
            listRow({
                rcept_no: '20261014000790',
                rcept_dt: '20261014',
                corp_code: OUTSIDE_CORP,
                report_nm: '임원ㆍ주요주주특정증권등거래계획보고서',
            }),
        ],
    },
    majorStock: {
        [SAMSUNG_CORP]: majorFor(SAMSUNG_CORP),
        [HANWHA_CORP]: majorFor(HANWHA_CORP),
        [SK_CORP]: [],
    },
    executiveStock: {
        [SAMSUNG_CORP]: executiveFor(SAMSUNG_CORP),
        [HANWHA_CORP]: executiveFor(HANWHA_CORP),
        [SK_CORP]: [],
    },
};

interface Scenario {
    data?: FakeDartData;
    state?: Record<string, string>;
    corpByStock?: Map<string, string>;
    symbols?: string[];
    /** 요청마다 불려 오류를 돌려주면 그 요청이 던진다. */
    fail?: (endpoint: string, arg: string) => Error | undefined;
    /** 공시검색 페이지 수를 강제한다(넘침 시험). */
    totalPage?: (query: DartListQuery) => number | undefined;
    deadlineAfterCalls?: number;
    enabled?: boolean;
}

function build(scenario: Scenario = {}) {
    const state = new Map(Object.entries(scenario.state ?? {}));
    const fake = createFakeDartClient(scenario.data ?? DEFAULT_DATA);
    const listQueries: DartListQuery[] = [];
    const corpCalls: string[] = [];
    const failing = <T>(
        endpoint: string,
        arg: string,
        run: () => Promise<T>
    ) => {
        const error = scenario.fail?.(endpoint, arg);
        return error === undefined ? run() : Promise.reject(error);
    };
    const dart: DartClient = {
        ...fake,
        isEnabled: () => scenario.enabled ?? true,
        fetchDisclosureList: async query => {
            listQueries.push(query);
            return failing('list.json', query.detailType, async () => {
                const page = await fake.fetchDisclosureList(query);
                return {
                    ...page,
                    totalPage: scenario.totalPage?.(query) ?? page.totalPage,
                };
            });
        },
        fetchMajorStock: async corpCode => {
            corpCalls.push(`major:${corpCode}`);
            return failing('majorstock.json', corpCode, () =>
                fake.fetchMajorStock(corpCode)
            );
        },
        fetchExecutiveStock: async corpCode => {
            corpCalls.push(`exec:${corpCode}`);
            return failing('elestock.json', corpCode, () =>
                fake.fetchExecutiveStock(corpCode)
            );
        },
    };
    const stored = {
        major: [] as DartMajorHoldingRow[],
        insider: [] as DartInsiderReportRow[],
        plans: [] as DartTradingPlanRow[],
        prunes: [] as string[],
        invalidated: [] as string[],
    };
    const log = vi.fn();
    const onBackfillCompleted = vi.fn();
    const repo: IngestDartFilingsDeps['repo'] = {
        getState: async key => state.get(key) ?? null,
        setState: async (key, value) => {
            state.set(key, value);
        },
        setStateIfAbsent: async (key, value) => {
            if (!state.has(key)) state.set(key, value);
        },
        listKrSymbols: async () => scenario.symbols ?? SYMBOLS,
        loadCorpCodeMap: async () => scenario.corpByStock ?? CORP_BY_STOCK,
        upsertMajorHoldings: async rows => {
            stored.major.push(...rows);
        },
        upsertInsiderReports: async rows => {
            stored.insider.push(...rows);
        },
        upsertTradingPlans: async rows => {
            stored.plans.push(...rows);
        },
        pruneBefore: async cutoff => {
            stored.prunes.push(cutoff);
            return 3;
        },
    };
    const calls = () => listQueries.length + corpCalls.length;
    const deps: IngestDartFilingsDeps = {
        dart,
        repo,
        fatalReason: dartFatalReason,
        now: () => NOW,
        isDeadlineReached: () =>
            scenario.deadlineAfterCalls !== undefined &&
            calls() >= scenario.deadlineAfterCalls,
        invalidateSymbols: symbols => {
            stored.invalidated.push(...symbols);
        },
        onBackfillCompleted,
        log,
    };
    return {
        deps,
        state,
        stored,
        listQueries,
        corpCalls,
        log,
        onBackfillCompleted,
    };
}

const listCursorOf = (state: Map<string, string>) =>
    parseDartListCursor(
        state.get(INVESTOR_FLOWS_STATE_DART_LIST_CURSOR) ?? null
    );

describe('runDartFilingsIngest — gates', () => {
    it('without a key: no request and no DB access', async () => {
        const { deps, listQueries, corpCalls } = build({ enabled: false });
        const loadCorpCodeMap = vi.spyOn(deps.repo, 'loadCorpCodeMap');
        const result = await runDartFilingsIngest(deps);
        expect(result.status).toBe('disabled');
        expect(result.calls).toBe(0);
        expect(listQueries).toEqual([]);
        expect(corpCalls).toEqual([]);
        expect(loadCorpCodeMap).not.toHaveBeenCalled();
    });

    it('waits for dart-corp-code when the corp code map is empty', async () => {
        const { deps, listQueries } = build({ corpByStock: new Map() });
        expect((await runDartFilingsIngest(deps)).status).toBe(
            'corp_codes_missing'
        );
        expect(listQueries).toEqual([]);
    });

    it('stops when no listed KR symbol maps to a corp', async () => {
        const { deps, listQueries } = build({ symbols: ['069500.KS', 'AAPL'] });
        expect((await runDartFilingsIngest(deps)).status).toBe(
            'empty_universe'
        );
        expect(listQueries).toEqual([]);
    });
});

describe('runDartFilingsIngest — first run', () => {
    it('scans D001/D002 for the last week and D005 for the full 3-month search window', async () => {
        const { deps, listQueries } = build();
        await runDartFilingsIngest(deps);
        const startOf = (type: DartDisclosureDetailType) =>
            listQueries.find(query => query.detailType === type)?.beginDate;
        expect(startOf('D001')).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS)
        );
        expect(startOf('D002')).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS)
        );
        expect(startOf('D005')).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS)
        );
        expect(listQueries.every(query => query.endDate === TODAY)).toBe(true);
    });

    it('calls the backfill-completed hook once, on the run that first writes the marker', async () => {
        const { deps, onBackfillCompleted } = build();
        await runDartFilingsIngest(deps);
        expect(onBackfillCompleted).toHaveBeenCalledTimes(1);
    });

    it('refetches the corps with new filings first, then backfills the rest, and marks the backfill done', async () => {
        const { deps, corpCalls, state } = build();
        const result = await runDartFilingsIngest(deps);
        expect(corpCalls).toEqual([
            `major:${SAMSUNG_CORP}`,
            `exec:${SAMSUNG_CORP}`,
            `major:${HANWHA_CORP}`,
            `exec:${HANWHA_CORP}`,
            `major:${SK_CORP}`,
            `exec:${SK_CORP}`,
        ]);
        expect(result).toMatchObject({
            status: 'complete',
            listComplete: true,
            changedCorps: 2,
            corpsRefetched: 2,
            backfillCorps: 1,
            backfillRemaining: 0,
            backfillDone: true,
            pendingRemaining: 0,
            unmappedSymbols: 1,
            calls: 3 + 6,
        });
        expect(state.get(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)).toBe(TODAY);
        expect(listCursorOf(state)).toEqual({
            through: TODAY,
            pending: [],
            tradingPlansFrom: null,
        });
        expect(
            parseDartBackfillCursor(
                state.get(INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR) ?? null
            )
        ).toEqual({ afterCorpCode: SK_CORP });
    });

    it('ignores filings of corps outside the KR universe', async () => {
        const { deps, corpCalls, stored } = build();
        await runDartFilingsIngest(deps);
        expect(corpCalls.some(call => call.endsWith(OUTSIDE_CORP))).toBe(false);
        expect(stored.plans.map(plan => plan.corpCode)).toEqual([SAMSUNG_CORP]);
    });

    it('stores D005 list rows as trading plans', async () => {
        const { deps, stored } = build();
        const result = await runDartFilingsIngest(deps);
        expect(stored.plans).toEqual([
            {
                rceptNo: '20261014000789',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-10-14',
                reporter: '이임원',
                title: '임원ㆍ주요주주특정증권등거래계획보고서',
            },
        ]);
        expect(result.tradingPlansStored).toBe(1);
    });

    it('stores major-holding and insider rows and invalidates every symbol of a changed corp (preferred included)', async () => {
        const { deps, stored } = build();
        const result = await runDartFilingsIngest(deps);
        expect(stored.major.map(row => [row.corpCode, row.rceptNo])).toEqual([
            [SAMSUNG_CORP, '20260311000555'],
            [SAMSUNG_CORP, '20260105000101'],
            [HANWHA_CORP, '20260311000555'],
            [HANWHA_CORP, '20260105000101'],
        ]);
        expect(stored.insider).toHaveLength(6);
        expect(result.majorRowsStored).toBe(4);
        expect(result.insiderRowsStored).toBe(6);
        // SK hynix returned no rows — nothing changed for it.
        expect(stored.invalidated).toEqual([
            '000880.KS',
            '00088K.KS',
            '005930.KS',
            '005935.KS',
        ]);
        expect(result.invalidated).toBe(4);
    });

    it('keeps only the last two years and prunes below the same floor', async () => {
        const floor = addDays(TODAY, -INVESTOR_FLOWS_DART_RETENTION_DAYS);
        const old = {
            ...MAJOR_STOCK_LIST[0],
            rcept_no: '20200101000001',
            rcept_dt: '20200101',
        };
        const { deps, stored } = build({
            data: {
                ...DEFAULT_DATA,
                majorStock: {
                    ...DEFAULT_DATA.majorStock,
                    [SAMSUNG_CORP]: [...majorFor(SAMSUNG_CORP), old],
                },
            },
        });
        const result = await runDartFilingsIngest(deps);
        expect(stored.major.some(row => row.rceptNo === '20200101000001')).toBe(
            false
        );
        expect(stored.prunes).toEqual([floor]);
        expect(result.pruned).toBe(3);
    });

    it('uses the KST date: 15:30 UTC on the 15th is already the 16th in Seoul', async () => {
        const { deps, listQueries } = build();
        await runDartFilingsIngest({
            ...deps,
            now: () => new Date('2026-10-15T15:30:00Z'),
        });
        expect(listQueries[0]?.endDate).toBe(TODAY);
    });
});

describe('runDartFilingsIngest — later runs', () => {
    const doneState = {
        [INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE]: '2026-10-10',
        [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
            through: '2026-10-15',
            pending: [],
        }),
    };

    it('does not call the backfill-completed hook once the marker already exists', async () => {
        const { deps, onBackfillCompleted } = build({ state: doneState });
        await runDartFilingsIngest(deps);
        expect(onBackfillCompleted).not.toHaveBeenCalled();
    });

    it('rescans from the cursor day itself and refetches only corps with new filings', async () => {
        const { deps, listQueries, corpCalls } = build({ state: doneState });
        const result = await runDartFilingsIngest(deps);
        expect(listQueries.map(query => query.beginDate)).toEqual([
            '2026-10-15',
            '2026-10-15',
            '2026-10-15',
        ]);
        expect(corpCalls).toEqual([
            `major:${SAMSUNG_CORP}`,
            `exec:${SAMSUNG_CORP}`,
            `major:${HANWHA_CORP}`,
            `exec:${HANWHA_CORP}`,
        ]);
        expect(result.backfillCorps).toBe(0);
        expect(result.backfillDone).toBe(true);
    });

    it('clamps a stale cursor to the 3-month search limit', async () => {
        const { deps, listQueries } = build({
            state: {
                ...doneState,
                [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
                    through: '2026-01-01',
                    pending: [],
                }),
            },
        });
        await runDartFilingsIngest(deps);
        expect(new Set(listQueries.map(query => query.beginDate))).toEqual(
            new Set([
                addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS),
            ])
        );
    });

    it('drains a pending corp left by an earlier run and drops pending corps that left the universe', async () => {
        const { deps, corpCalls, state } = build({
            data: { ...DEFAULT_DATA, disclosures: {} },
            state: {
                ...doneState,
                [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
                    through: '2026-10-15',
                    pending: [
                        { corpCode: SK_CORP, attempts: 1 },
                        { corpCode: OUTSIDE_CORP, attempts: 0 },
                    ],
                }),
            },
        });
        const result = await runDartFilingsIngest(deps);
        expect(corpCalls).toEqual([`major:${SK_CORP}`, `exec:${SK_CORP}`]);
        expect(result.corpsRefetched).toBe(1);
        expect(listCursorOf(state).pending).toEqual([]);
    });

    it('queues the whole universe when a D001/D002 window overflows the page cap', async () => {
        const { deps, corpCalls, log } = build({
            state: doneState,
            totalPage: query =>
                query.detailType === 'D002'
                    ? INVESTOR_FLOWS_DART_MAX_LIST_PAGES + 5
                    : undefined,
        });
        const result = await runDartFilingsIngest(deps);
        expect(new Set(corpCalls.map(call => call.split(':')[1]))).toEqual(
            new Set([SAMSUNG_CORP, HANWHA_CORP, SK_CORP])
        );
        expect(result.listPages).toBe(
            1 + INVESTOR_FLOWS_DART_MAX_LIST_PAGES + 1
        );
        expect(
            log.mock.calls.some(([message]) =>
                String(message).includes('queueing the whole universe')
            )
        ).toBe(true);
    });
});

describe('runDartFilingsIngest — D005 page-cap overflow', () => {
    const D005_FLOOR = addDays(
        TODAY,
        -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS
    );
    const overflowD005 = (query: DartListQuery) =>
        query.detailType === 'D005'
            ? INVESTOR_FLOWS_DART_MAX_LIST_PAGES + 3
            : undefined;

    it('keeps the D005 resume date at the last receipt date it read instead of advancing to today', async () => {
        const { deps, state, stored } = build({ totalPage: overflowD005 });
        const result = await runDartFilingsIngest(deps);
        // The first D005 page holds both 2026-10-14 rows; the rest of the cap is empty.
        expect(stored.plans.map(plan => plan.rceptNo)).toEqual([
            '20261014000789',
        ]);
        expect(result.listComplete).toBe(false);
        expect(listCursorOf(state)).toEqual({
            through: TODAY,
            pending: [],
            tradingPlansFrom: '2026-10-14',
        });
    });

    it('resumes D005 from that date on the next run while D001/D002 read from the cursor, then clears it', async () => {
        const first = build({ totalPage: overflowD005 });
        await runDartFilingsIngest(first.deps);
        const second = build({ state: Object.fromEntries(first.state) });
        const result = await runDartFilingsIngest(second.deps);
        const startOf = (type: DartDisclosureDetailType) =>
            second.listQueries.find(query => query.detailType === type)
                ?.beginDate;
        expect(startOf('D001')).toBe(TODAY);
        expect(startOf('D002')).toBe(TODAY);
        expect(startOf('D005')).toBe('2026-10-14');
        expect(result.listComplete).toBe(true);
        expect(listCursorOf(second.state).tradingPlansFrom).toBeNull();
    });

    it('moves past a start day that alone fills the page cap, so the next run makes progress', async () => {
        const floorCompact = D005_FLOOR.replaceAll('-', '');
        const { deps, state, log } = build({
            totalPage: overflowD005,
            data: {
                ...DEFAULT_DATA,
                disclosures: {
                    ...DEFAULT_DATA.disclosures,
                    D005: [
                        listRow({
                            rcept_no: `${floorCompact}000001`,
                            rcept_dt: floorCompact,
                            report_nm: '임원ㆍ주요주주특정증권등거래계획보고서',
                        }),
                    ],
                },
            },
        });
        await runDartFilingsIngest(deps);
        expect(listCursorOf(state).tradingPlansFrom).toBe(
            addDays(D005_FLOOR, 1)
        );
        expect(
            log.mock.calls.some(([message]) =>
                String(message).includes('skipping the rest of that day')
            )
        ).toBe(true);
    });

    it('keeps an earlier D005 resume date when the scan stops before finishing', async () => {
        const { deps, state } = build({
            state: {
                [INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE]: '2026-10-10',
                [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
                    through: '2026-10-15',
                    pending: [],
                    tradingPlansFrom: '2026-09-01',
                }),
            },
            fail: (endpoint, arg) =>
                endpoint === 'list.json' && arg === 'D001'
                    ? new DartApiError('list.json', 'HTTP 503', {
                          httpStatus: 503,
                      })
                    : undefined,
        });
        await runDartFilingsIngest(deps);
        expect(listCursorOf(state)).toEqual({
            through: '2026-10-15',
            pending: [],
            tradingPlansFrom: '2026-09-01',
        });
    });
});

describe('runDartFilingsIngest — rows of another report type', () => {
    const MISMATCHED: FakeDartData = {
        ...DEFAULT_DATA,
        disclosures: {
            ...DEFAULT_DATA.disclosures,
            // A D002 title under D005 — what an ignored detail filter returns.
            D005: [
                ...(DEFAULT_DATA.disclosures.D005 ?? []),
                listRow({
                    rcept_no: '20261014000901',
                    rcept_dt: '20261014',
                    report_nm: '임원ㆍ주요주주특정증권등소유상황보고서',
                }),
            ],
            // A trading plan under D002 for a corp with no other filing.
            D002: [
                ...(DEFAULT_DATA.disclosures.D002 ?? []),
                listRow({
                    rcept_no: '20261015000902',
                    corp_code: SK_CORP,
                    stock_code: '000660',
                    report_nm: '임원ㆍ주요주주특정증권등거래계획보고서',
                }),
            ],
        },
    };

    it('does not store a mismatched D005 row as a trading plan', async () => {
        const { deps, stored } = build({ data: MISMATCHED });
        await runDartFilingsIngest(deps);
        expect(stored.plans.map(plan => plan.rceptNo)).toEqual([
            '20261014000789',
        ]);
    });

    it('does not queue a corp whose only D002 row is another report type', async () => {
        const { deps } = build({
            data: MISMATCHED,
            state: {
                [INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE]: '2026-10-10',
            },
        });
        const result = await runDartFilingsIngest(deps);
        // Samsung (D001) and Hanwha (D002) only — SK hynix's row was a trading plan.
        expect(result.changedCorps).toBe(2);
    });

    it('counts and logs the dropped rows', async () => {
        const { deps, log } = build({ data: MISMATCHED });
        const result = await runDartFilingsIngest(deps);
        expect(result.mismatchedRows).toBe(2);
        expect(
            log.mock.calls.filter(([message]) =>
                String(message).includes('rows of another report type')
            )
        ).toHaveLength(2);
    });

    it('keeps amended and withdrawn titles of the requested type', async () => {
        const { deps, stored } = build({
            data: {
                ...DEFAULT_DATA,
                disclosures: {
                    D005: [
                        listRow({
                            rcept_no: '20261014000903',
                            rcept_dt: '20261014',
                            report_nm:
                                '[기재정정]임원ㆍ주요주주특정증권등거래계획보고서',
                        }),
                        listRow({
                            rcept_no: '20261014000904',
                            rcept_dt: '20261014',
                            report_nm:
                                '임원ㆍ주요주주특정증권등거래계획철회보고서',
                        }),
                    ],
                },
            },
        });
        const result = await runDartFilingsIngest(deps);
        expect(stored.plans.map(plan => plan.rceptNo)).toEqual([
            '20261014000903',
            '20261014000904',
        ]);
        expect(result.mismatchedRows).toBe(0);
    });
});

describe('runDartFilingsIngest — stopping and resuming', () => {
    it('keeps the cursor when a list request fails and still drains what it has', async () => {
        const { deps, state, corpCalls } = build({
            state: {
                [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
                    through: '2026-10-14',
                    pending: [{ corpCode: SK_CORP, attempts: 0 }],
                }),
                [INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE]: '2026-10-10',
            },
            fail: (endpoint, arg) =>
                endpoint === 'list.json' && arg === 'D002'
                    ? new DartApiError('list.json', 'HTTP 503', {
                          httpStatus: 503,
                      })
                    : undefined,
        });
        const result = await runDartFilingsIngest(deps);
        expect(result.listComplete).toBe(false);
        expect(listCursorOf(state).through).toBe('2026-10-14');
        // D001 found Samsung before D002 failed; both it and the old pending corp are refetched.
        expect(corpCalls).toEqual([
            `major:${SK_CORP}`,
            `exec:${SK_CORP}`,
            `major:${SAMSUNG_CORP}`,
            `exec:${SAMSUNG_CORP}`,
        ]);
    });

    it('stops the whole run on a quota refusal and keeps the corp queued', async () => {
        const { deps, state, corpCalls } = build({
            fail: (endpoint, arg) =>
                endpoint === 'elestock.json' && arg === HANWHA_CORP
                    ? new DartQuotaError('elestock.json', 'quota')
                    : undefined,
        });
        const result = await runDartFilingsIngest(deps);
        expect(result.status).toBe('quota_exhausted');
        expect(corpCalls).toEqual([
            `major:${SAMSUNG_CORP}`,
            `exec:${SAMSUNG_CORP}`,
            `major:${HANWHA_CORP}`,
            `exec:${HANWHA_CORP}`,
        ]);
        expect(listCursorOf(state).pending).toEqual([
            { corpCode: HANWHA_CORP, attempts: 0 },
        ]);
        expect(result.backfillDone).toBe(false);
        expect(state.has(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)).toBe(false);
    });

    it('re-queues a corp that failed for its own reasons and drops it after the attempt cap', async () => {
        const failHanwha = (endpoint: string, arg: string) =>
            endpoint === 'majorstock.json' && arg === HANWHA_CORP
                ? new DartApiError('majorstock.json', 'status 100', {
                      dartStatus: '100',
                  })
                : undefined;
        const first = build({ fail: failHanwha });
        const firstResult = await runDartFilingsIngest(first.deps);
        expect(firstResult.status).toBe('complete');
        expect(firstResult.failedCorps).toBe(1);
        expect(listCursorOf(first.state).pending).toEqual([
            { corpCode: HANWHA_CORP, attempts: 1 },
        ]);

        const last = build({
            fail: failHanwha,
            data: { ...DEFAULT_DATA, disclosures: {} },
            state: {
                [INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE]: TODAY,
                [INVESTOR_FLOWS_STATE_DART_LIST_CURSOR]: JSON.stringify({
                    through: TODAY,
                    pending: [
                        {
                            corpCode: HANWHA_CORP,
                            attempts: INVESTOR_FLOWS_DART_MAX_ATTEMPTS - 1,
                        },
                    ],
                }),
            },
        });
        const lastResult = await runDartFilingsIngest(last.deps);
        expect(lastResult.droppedCorps).toBe(1);
        expect(listCursorOf(last.state).pending).toEqual([]);
    });

    it('stops at the deadline and resumes the backfill where it left off', async () => {
        const first = build({
            data: { ...DEFAULT_DATA, disclosures: {} },
            deadlineAfterCalls: 3 + 2,
        });
        const firstResult = await runDartFilingsIngest(first.deps);
        expect(firstResult.status).toBe('deadline');
        expect(firstResult.backfillCorps).toBe(1);
        expect(firstResult.backfillRemaining).toBe(2);

        const second = build({
            data: { ...DEFAULT_DATA, disclosures: {} },
            state: Object.fromEntries(first.state),
        });
        const secondResult = await runDartFilingsIngest(second.deps);
        expect(second.corpCalls).toEqual([
            `major:${HANWHA_CORP}`,
            `exec:${HANWHA_CORP}`,
            `major:${SK_CORP}`,
            `exec:${SK_CORP}`,
        ]);
        expect(secondResult.backfillDone).toBe(true);
    });

    it('stops at the per-run call cap and reports what is left', async () => {
        const corpCount = INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN; // 2 calls each → twice the cap
        const corpByStock = new Map(
            Array.from({ length: corpCount }, (_, index) => [
                String(100_000 + index * 10),
                String(10_000_000 + index),
            ])
        );
        const symbols = [...corpByStock.keys()].map(code => `${code}.KS`);
        const { deps, state } = build({
            data: {
                corpCodes: [],
                disclosures: {},
                majorStock: {},
                executiveStock: {},
            },
            corpByStock,
            symbols,
        });
        const result = await runDartFilingsIngest(deps);
        expect(result.status).toBe('call_cap');
        expect(result.calls).toBeLessThanOrEqual(
            INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN
        );
        expect(result.backfillCorps).toBe(
            Math.floor((INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN - 3) / 2)
        );
        expect(result.backfillRemaining).toBe(corpCount - result.backfillCorps);
        expect(state.has(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)).toBe(false);
    });
});
