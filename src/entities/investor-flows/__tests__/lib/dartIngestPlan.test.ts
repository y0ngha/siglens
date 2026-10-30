import { describe, expect, it } from 'vitest';
import {
    EMPTY_DART_BACKFILL_CURSOR,
    EMPTY_DART_LIST_CURSOR,
    type DartListCursor,
} from '../../lib/dartIngestState';
import {
    backfillTargetsAfter,
    latestReceiptDate,
    nextPendingQueue,
    overflowResume,
    scanStart,
    symbolsToInvalidate,
} from '../../lib/dartIngestPlan';
import {
    INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';

const TODAY = '2026-10-15';

describe('scanStart', () => {
    it('starts D001/D002 at the initial lookback when there is no cursor', () => {
        expect(scanStart(EMPTY_DART_LIST_CURSOR, 'D001', TODAY)).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS)
        );
    });

    it('starts D005 at the widest searchable window when there is no cursor', () => {
        expect(scanStart(EMPTY_DART_LIST_CURSOR, 'D005', TODAY)).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS)
        );
    });

    it('resumes D001/D002 from the cursor date', () => {
        const cursor: DartListCursor = {
            ...EMPTY_DART_LIST_CURSOR,
            through: '2026-10-10',
            tradingPlansFrom: '2026-09-01',
        };
        expect(scanStart(cursor, 'D002', TODAY)).toBe('2026-10-10');
    });

    it('resumes D005 from tradingPlansFrom before the cursor date', () => {
        const cursor: DartListCursor = {
            ...EMPTY_DART_LIST_CURSOR,
            through: '2026-10-10',
            tradingPlansFrom: '2026-09-01',
        };
        expect(scanStart(cursor, 'D005', TODAY)).toBe('2026-09-01');
    });

    it('falls back to the cursor date for D005 when tradingPlansFrom is null', () => {
        const cursor: DartListCursor = {
            ...EMPTY_DART_LIST_CURSOR,
            through: '2026-10-10',
        };
        expect(scanStart(cursor, 'D005', TODAY)).toBe('2026-10-10');
    });

    it('clamps a stale cursor to the three-month search limit', () => {
        const cursor: DartListCursor = {
            ...EMPTY_DART_LIST_CURSOR,
            through: '2025-01-01',
        };
        expect(scanStart(cursor, 'D001', TODAY)).toBe(
            addDays(TODAY, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS)
        );
    });
});

describe('latestReceiptDate', () => {
    it('returns the carried value when there are no rows', () => {
        expect(latestReceiptDate([], '2026-10-01')).toBe('2026-10-01');
        expect(latestReceiptDate([], null)).toBeNull();
    });

    it('takes the latest row date when it is later than the carried value', () => {
        expect(
            latestReceiptDate(
                [{ receiptDate: '2026-10-03' }, { receiptDate: '2026-10-02' }],
                '2026-10-01'
            )
        ).toBe('2026-10-03');
    });

    it('keeps the carried value when it is later than every row', () => {
        expect(
            latestReceiptDate([{ receiptDate: '2026-09-01' }], '2026-10-01')
        ).toBe('2026-10-01');
    });
});

describe('overflowResume', () => {
    it('resumes from the last receipt date when it passed the window start', () => {
        expect(overflowResume('2026-10-05', '2026-10-01')).toEqual({
            date: '2026-10-05',
            daySaturated: false,
        });
    });

    it('moves to the next day when every page was the start day', () => {
        expect(overflowResume('2026-10-01', '2026-10-01')).toEqual({
            date: '2026-10-02',
            daySaturated: true,
        });
    });

    it('treats no rows read as a saturated start day', () => {
        expect(overflowResume(null, '2026-10-01')).toEqual({
            date: '2026-10-02',
            daySaturated: true,
        });
    });
});

describe('nextPendingQueue', () => {
    it('appends new corps after the previous queue and keeps the larger attempt count', () => {
        const queue = nextPendingQueue(
            [
                { corpCode: '00000001', attempts: 2 },
                { corpCode: '00000002', attempts: 0 },
            ],
            new Set(['00000002', '00000003']),
            new Set(['00000001', '00000002', '00000003'])
        );
        expect(queue).toEqual([
            { corpCode: '00000001', attempts: 2 },
            { corpCode: '00000002', attempts: 0 },
            { corpCode: '00000003', attempts: 0 },
        ]);
    });

    it('drops corps that left the universe', () => {
        expect(
            nextPendingQueue(
                [{ corpCode: '00000001', attempts: 1 }],
                new Set(['00000009']),
                new Set(['00000002'])
            )
        ).toEqual([]);
    });
});

describe('backfillTargetsAfter', () => {
    const corps = ['00000001', '00000002', '00000003'];

    it('returns every corp when the cursor is empty', () => {
        expect(backfillTargetsAfter(corps, EMPTY_DART_BACKFILL_CURSOR)).toEqual(
            corps
        );
    });

    it('returns only the corps after the cursor', () => {
        expect(
            backfillTargetsAfter(corps, { afterCorpCode: '00000002' })
        ).toEqual(['00000003']);
    });

    it('returns nothing once the cursor reached the last corp', () => {
        expect(
            backfillTargetsAfter(corps, { afterCorpCode: '00000003' })
        ).toEqual([]);
    });
});

describe('symbolsToInvalidate', () => {
    const symbolsByCorp = new Map<string, readonly string[]>([
        ['00000001', ['005930']],
        ['00000002', ['005935', '000660']],
    ]);

    it('flattens and sorts the symbols of the changed corps', () => {
        expect(
            symbolsToInvalidate(
                new Set(['00000002', '00000001']),
                symbolsByCorp
            )
        ).toEqual(['000660', '005930', '005935']);
    });

    it('ignores corps without symbols', () => {
        expect(
            symbolsToInvalidate(new Set(['99999999']), symbolsByCorp)
        ).toEqual([]);
    });

    it('caps the list at the revalidation limit', () => {
        const many = new Map<string, readonly string[]>([
            [
                '00000001',
                Array.from(
                    { length: INVESTOR_FLOWS_REVALIDATE_CAP + 5 },
                    (_, i) => String(i).padStart(6, '0')
                ),
            ],
        ]);
        expect(symbolsToInvalidate(new Set(['00000001']), many)).toHaveLength(
            INVESTOR_FLOWS_REVALIDATE_CAP
        );
    });
});
