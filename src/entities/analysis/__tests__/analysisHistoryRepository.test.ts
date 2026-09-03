/**
 * `analysisHistoryQuery`만 spy로 override한다 — findRecentForPrompt는 이
 * 함수가 돌려주는 limit/sinceMs를 그대로 쿼리 빌더에 넘겨야 하므로, 로컬에서
 * 공식을 재구현하는 테스트는 무의미하다(core 계약이 바뀌면 조용히 어긋난다).
 * 나머지 export는 실제 구현을 그대로 쓴다.
 */
const analysisHistoryQuerySpy = vi.fn();
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const original =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...original,
        analysisHistoryQuery: (
            ...args: Parameters<typeof original.analysisHistoryQuery>
        ) =>
            analysisHistoryQuerySpy(...args) as ReturnType<
                typeof original.analysisHistoryQuery
            >,
    };
});

/**
 * eq/gte/lt/isNotNull/notExists/inArray만 spy로 래핑해 findRecentForPrompt와
 * pruneAnalysisHistory가 어떤 column/value로 필터를 거는지 단언한다(특히
 * findRecentForPrompt에서 model_id/locale 필터가 **없다**는 걸 증명하려면 eq 호출
 * 횟수를 세야 한다; pruneAnalysisHistory에서는 두 retention cutoff와 orphan-blob
 * notExists 조건이 정확한 컬럼/서브쿼리를 가리키는지 확인한다). and/desc는 실제
 * 구현을 그대로 써서 쿼리 빌더 체인을 보존한다.
 */
const eqSpy = vi.fn();
const gteSpy = vi.fn();
const ltSpy = vi.fn();
const isNotNullSpy = vi.fn();
const notExistsSpy = vi.fn();
const inArraySpy = vi.fn();
vi.mock('drizzle-orm', async importOriginal => {
    const original = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...original,
        eq: (...args: Parameters<typeof original.eq>) => {
            eqSpy(...args);
            return original.eq(...args);
        },
        gte: (...args: Parameters<typeof original.gte>) => {
            gteSpy(...args);
            return original.gte(...args);
        },
        lt: (...args: Parameters<typeof original.lt>) => {
            ltSpy(...args);
            return original.lt(...args);
        },
        isNotNull: (...args: Parameters<typeof original.isNotNull>) => {
            isNotNullSpy(...args);
            return original.isNotNull(...args);
        },
        notExists: (...args: Parameters<typeof original.notExists>) => {
            notExistsSpy(...args);
            return original.notExists(...args);
        },
        inArray: (...args: Parameters<typeof original.inArray>) => {
            inArraySpy(...args);
            return original.inArray(...args);
        },
    };
});

import { createHash } from 'node:crypto';
import type {
    AssembledPromptRecord,
    PriorAnalysis,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { analysisHistory, analysisPromptBlobs } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleAnalysisHistoryRepository,
    ORPHAN_BLOB_MIN_AGE_MS,
    PROMPT_DYNAMIC_RETENTION_DAYS,
    PRUNE_BATCH_SIZE,
    RESULT_RETENTION_DAYS,
} from '@/entities/analysis/analysisHistoryRepository';

function sha256Hex(body: string): string {
    return createHash('sha256').update(body, 'utf8').digest('hex');
}

function makeDb(options?: { historyFails?: boolean; blobFails?: boolean }): {
    db: SiglensDatabase;
    insert: ReturnType<typeof vi.fn>;
    blobValues: ReturnType<typeof vi.fn>;
    blobOnConflict: ReturnType<typeof vi.fn>;
    historyValues: ReturnType<typeof vi.fn>;
} {
    const blobOnConflict = vi.fn(
        options?.blobFails
            ? () => Promise.reject(new Error('blob insert failed'))
            : () => Promise.resolve(undefined)
    );
    const blobValues = vi.fn(() => ({ onConflictDoNothing: blobOnConflict }));

    const historyValues = vi.fn(
        options?.historyFails
            ? () => Promise.reject(new Error('history insert failed'))
            : () => Promise.resolve(undefined)
    );

    const insert = vi.fn((table: unknown) => {
        if (table === analysisPromptBlobs) return { values: blobValues };
        if (table === analysisHistory) return { values: historyValues };
        throw new Error(`unexpected table in insert(): ${String(table)}`);
    });

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        blobValues,
        blobOnConflict,
        historyValues,
    };
}

const promptRecord: AssembledPromptRecord = {
    system: 'system prompt text',
    stable: 'stable skill digest',
    dynamic: 'dynamic per-call block',
    promptVersion: 'v7',
};

describe('DrizzleAnalysisHistoryRepository', () => {
    it('upserts both prompt blobs and stores their hashes on the history row when a prompt is captured', async () => {
        const { db, insert, blobValues, blobOnConflict, historyValues } =
            makeDb();
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const generatedAt = new Date('2026-08-30T00:00:00.000Z');

        await repository.saveAnalysisHistory({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            modelId: 'analysis-worker',
            locale: 'ko',
            result: { trend: 'bullish' },
            generatedAt,
            prompt: promptRecord,
        });

        expect(insert).toHaveBeenCalledWith(analysisPromptBlobs);
        expect(blobValues).toHaveBeenCalledWith([
            { hash: sha256Hex(promptRecord.stable), body: promptRecord.stable },
            { hash: sha256Hex(promptRecord.system), body: promptRecord.system },
        ]);
        expect(blobOnConflict).toHaveBeenCalledWith({
            target: analysisPromptBlobs.hash,
        });

        expect(insert).toHaveBeenCalledWith(analysisHistory);
        expect(historyValues).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            modelId: 'analysis-worker',
            locale: 'ko',
            result: { trend: 'bullish' },
            inputFingerprint: null,
            promptVersion: 'v7',
            promptStableHash: sha256Hex(promptRecord.stable),
            promptSystemHash: sha256Hex(promptRecord.system),
            promptDynamic: promptRecord.dynamic,
            generatedAt,
        });
    });

    it('stores a null-prompt history row without touching the blob table when no prompt was captured (concurrent-loser path)', async () => {
        const { db, insert, historyValues } = makeDb();
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const generatedAt = new Date('2026-08-30T00:00:00.000Z');

        await repository.saveAnalysisHistory({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'overall',
            modelId: 'analysis-worker',
            locale: 'en',
            result: { trend: 'neutral' },
            generatedAt,
        });

        expect(insert).not.toHaveBeenCalledWith(analysisPromptBlobs);
        expect(historyValues).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'overall',
            modelId: 'analysis-worker',
            locale: 'en',
            result: { trend: 'neutral' },
            inputFingerprint: null,
            promptVersion: null,
            promptStableHash: null,
            promptSystemHash: null,
            promptDynamic: null,
            generatedAt,
        });
    });

    it('passes inputFingerprint through when supplied', async () => {
        const { historyValues, db } = makeDb();
        const repository = new DrizzleAnalysisHistoryRepository(db);

        await repository.saveAnalysisHistory({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            modelId: 'analysis-worker',
            locale: 'ko',
            result: {},
            generatedAt: new Date('2026-08-30T00:00:00.000Z'),
            inputFingerprint: 'fp-123',
        });

        expect(historyValues).toHaveBeenCalledWith(
            expect.objectContaining({ inputFingerprint: 'fp-123' })
        );
    });

    it('never throws when the blob insert fails (best-effort persistence)', async () => {
        const { db, historyValues } = makeDb({ blobFails: true });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            repository.saveAnalysisHistory({
                symbol: 'AAPL',
                timeframe: '1Day',
                tab: 'technical',
                modelId: 'analysis-worker',
                locale: 'ko',
                result: {},
                generatedAt: new Date('2026-08-30T00:00:00.000Z'),
                prompt: promptRecord,
            })
        ).resolves.toBeUndefined();

        // 블롭 실패 시 history insert까지 도달하지 않는다(순서상 앞선 await가 던짐).
        expect(historyValues).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
            '[analysisHistoryRepository] persist failed:',
            expect.any(Error)
        );
        consoleError.mockRestore();
    });

    it('never throws when the history insert fails (best-effort persistence)', async () => {
        const { db } = makeDb({ historyFails: true });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            repository.saveAnalysisHistory({
                symbol: 'AAPL',
                timeframe: '1Day',
                tab: 'overall',
                modelId: 'analysis-worker',
                locale: 'ko',
                result: {},
                generatedAt: new Date('2026-08-30T00:00:00.000Z'),
            })
        ).resolves.toBeUndefined();

        expect(consoleError).toHaveBeenCalledWith(
            '[analysisHistoryRepository] persist failed:',
            expect.any(Error)
        );
        consoleError.mockRestore();
    });
});

/** Chainable select/from/where/orderBy/limit stub resolving to `rows`. */
function makeSelectDb(
    rows: unknown[],
    options?: { limitFails?: boolean }
): {
    db: SiglensDatabase;
    spies: {
        select: ReturnType<typeof vi.fn>;
        from: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
    };
} {
    const limit = vi.fn(
        options?.limitFails
            ? () => Promise.reject(new Error('select failed'))
            : () => Promise.resolve(rows)
    );
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { select } as unknown as SiglensDatabase,
        spies: { select, from, where, orderBy, limit },
    };
}

describe('DrizzleAnalysisHistoryRepository.findRecentForPrompt', () => {
    const NOW = new Date('2026-08-30T00:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        analysisHistoryQuerySpy.mockReturnValue({
            limit: 7,
            sinceMs: 60 * 60 * 1000, // 1h — arbitrary, only used to assert propagation
        });
    });

    it('sizes the query from analysisHistoryQuery(timeframe) — since bound and limit both reach the query builder', async () => {
        const { db, spies } = makeSelectDb([]);
        const repository = new DrizzleAnalysisHistoryRepository(db);

        await repository.findRecentForPrompt({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            now: NOW,
        });

        expect(analysisHistoryQuerySpy).toHaveBeenCalledWith('1Day');

        expect(eqSpy).toHaveBeenCalledWith(analysisHistory.symbol, 'AAPL');
        expect(eqSpy).toHaveBeenCalledWith(analysisHistory.timeframe, '1Day');
        expect(eqSpy).toHaveBeenCalledWith(analysisHistory.tab, 'technical');
        // model_id/locale은 필터하지 않는다 — eq는 정확히 symbol/timeframe/tab
        // 3번만 호출돼야 한다. 늘어나면 누군가 금지된 필터를 추가한 것이다.
        expect(eqSpy).toHaveBeenCalledTimes(3);

        expect(gteSpy).toHaveBeenCalledWith(
            analysisHistory.generatedAt,
            new Date(NOW.getTime() - 60 * 60 * 1000)
        );

        // limit() received core's `limit` value, not a hand-picked constant.
        expect(spies.limit).toHaveBeenCalledWith(7);
    });

    it('rows are included regardless of which model/locale produced them (no such filter exists)', async () => {
        const rowFromModelA = {
            result: { trend: 'bullish', riskLevel: 'low' },
            generatedAt: new Date('2026-08-29T00:00:00.000Z'),
        };
        const rowFromModelB = {
            result: { trend: 'bearish', riskLevel: 'high' },
            generatedAt: new Date('2026-08-28T00:00:00.000Z'),
        };
        const { db } = makeSelectDb([rowFromModelA, rowFromModelB]);
        const repository = new DrizzleAnalysisHistoryRepository(db);

        const result = await repository.findRecentForPrompt({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'overall',
            now: NOW,
        });

        expect(result).toHaveLength(2);
        // The query never filters by model_id or locale.
        expect(eqSpy).toHaveBeenCalledTimes(3);
    });

    it('skips a row with a missing/invalid trend or riskLevel, keeps valid ones', async () => {
        const valid = {
            result: { trend: 'bullish', riskLevel: 'medium' },
            generatedAt: new Date('2026-08-29T00:00:00.000Z'),
        };
        const missingTrend = {
            result: { riskLevel: 'low' },
            generatedAt: new Date('2026-08-28T00:00:00.000Z'),
        };
        const invalidRiskLevel = {
            result: { trend: 'neutral', riskLevel: 42 },
            generatedAt: new Date('2026-08-27T00:00:00.000Z'),
        };
        const { db } = makeSelectDb([valid, missingTrend, invalidRiskLevel]);
        const repository = new DrizzleAnalysisHistoryRepository(db);

        const result = await repository.findRecentForPrompt({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            now: NOW,
        });

        expect(result).toEqual<PriorAnalysis[]>([
            {
                generatedAt: valid.generatedAt,
                trend: 'bullish',
                riskLevel: 'medium',
            },
        ]);
    });

    it('drops individual non-finite prices instead of the whole row', async () => {
        const row = {
            result: {
                trend: 'bullish',
                riskLevel: 'high',
                actionRecommendation: {
                    entryPrices: [100, Number.NaN, 105],
                    stopLoss: Number.POSITIVE_INFINITY,
                    takeProfitPrices: [110, Number.NEGATIVE_INFINITY, 120],
                },
            },
            generatedAt: new Date('2026-08-29T00:00:00.000Z'),
        };
        const { db } = makeSelectDb([row]);
        const repository = new DrizzleAnalysisHistoryRepository(db);

        const result = await repository.findRecentForPrompt({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            now: NOW,
        });

        expect(result).toEqual<PriorAnalysis[]>([
            {
                generatedAt: row.generatedAt,
                trend: 'bullish',
                riskLevel: 'high',
                entryPrices: [100, 105],
                takeProfitPrices: [110, 120],
            },
        ]);
    });

    it('returns [] and does not throw when the query fails', async () => {
        const { db } = makeSelectDb([], { limitFails: true });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            repository.findRecentForPrompt({
                symbol: 'AAPL',
                timeframe: '1Day',
                tab: 'technical',
                now: NOW,
            })
        ).resolves.toEqual([]);

        expect(consoleError).toHaveBeenCalledWith(
            '[analysisHistoryRepository] findRecentForPrompt failed:',
            expect.any(Error)
        );
        consoleError.mockRestore();
    });
});

/**
 * Chainable `select().from().where().limit()` / `delete().where().returning()` /
 * `update().set().where().returning()` stub covering every shape
 * `pruneAnalysisHistory` builds: the two capped row-id subqueries (staleRowIds,
 * promptClearIds), the two uncapped EXISTS subqueries (stop at `.where()`,
 * never call `.limit()`), and the capped orphan-hash subquery. All `.select()`
 * calls share one `where`/`limit` pair — the assertions below distinguish
 * individual calls via `ltSpy`/`isNotNullSpy`/`notExistsSpy`/`eqSpy` call
 * order and arguments (see the drizzle-orm mock above) rather than tracking
 * per-call subquery identity, since nothing here ever actually reaches a
 * driver — no fake object needs to behave like a real Drizzle subquery beyond
 * being an inert value `inArray`/`notExists` can wrap.
 */
function makePruneDb(options?: {
    deletedHistoryIds?: { id: string }[];
    clearedHistoryIds?: { id: string }[];
    deletedBlobHashes?: { hash: string }[];
    rejectAt?: 'deleteHistory' | 'updateHistory' | 'deleteBlobs';
}): {
    db: SiglensDatabase;
    spies: {
        select: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        deleteFn: ReturnType<typeof vi.fn>;
        updateFn: ReturnType<typeof vi.fn>;
        historySet: ReturnType<typeof vi.fn>;
        blobReturning: ReturnType<typeof vi.fn>;
    };
} {
    const rejectAt = options?.rejectAt;

    const limit = vi.fn(() => ({ __subquery: true }));
    const where = vi.fn(() => ({ limit, __subquery: true }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const historyReturning = vi.fn(() =>
        rejectAt === 'deleteHistory'
            ? Promise.reject(new Error('delete history failed'))
            : Promise.resolve(options?.deletedHistoryIds ?? [])
    );
    const historyDeleteWhere = vi.fn(() => ({ returning: historyReturning }));

    const historyUpdateReturning = vi.fn(() =>
        rejectAt === 'updateHistory'
            ? Promise.reject(new Error('update history failed'))
            : Promise.resolve(options?.clearedHistoryIds ?? [])
    );
    const historyUpdateWhere = vi.fn(() => ({
        returning: historyUpdateReturning,
    }));
    const historySet = vi.fn(() => ({ where: historyUpdateWhere }));

    const blobReturning = vi.fn(() =>
        rejectAt === 'deleteBlobs'
            ? Promise.reject(new Error('delete blobs failed'))
            : Promise.resolve(options?.deletedBlobHashes ?? [])
    );
    const blobDeleteWhere = vi.fn(() => ({ returning: blobReturning }));

    const deleteFn = vi.fn((table: unknown) => {
        if (table === analysisHistory) return { where: historyDeleteWhere };
        if (table === analysisPromptBlobs) return { where: blobDeleteWhere };
        throw new Error(`unexpected delete table: ${String(table)}`);
    });
    const updateFn = vi.fn((table: unknown) => {
        if (table === analysisHistory) return { set: historySet };
        throw new Error(`unexpected update table: ${String(table)}`);
    });

    return {
        db: {
            select,
            delete: deleteFn,
            update: updateFn,
        } as unknown as SiglensDatabase,
        spies: { select, limit, deleteFn, updateFn, historySet, blobReturning },
    };
}

describe('DrizzleAnalysisHistoryRepository.pruneAnalysisHistory', () => {
    const NOW = new Date('2026-08-30T00:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deletes rows past the 90-day result-retention cutoff, capped at PRUNE_BATCH_SIZE, and reports the deleted count', async () => {
        const { db, spies } = makePruneDb({
            deletedHistoryIds: [{ id: 'a' }, { id: 'b' }],
        });
        const repository = new DrizzleAnalysisHistoryRepository(db);

        const result = await repository.pruneAnalysisHistory(NOW);

        const expectedResultCutoff = new Date(
            NOW.getTime() - RESULT_RETENTION_DAYS * MS_PER_DAY
        );
        expect(ltSpy).toHaveBeenNthCalledWith(
            1,
            analysisHistory.generatedAt,
            expectedResultCutoff
        );
        expect(spies.limit).toHaveBeenNthCalledWith(1, PRUNE_BATCH_SIZE);
        expect(spies.deleteFn).toHaveBeenCalledWith(analysisHistory);
        expect(inArraySpy).toHaveBeenNthCalledWith(
            1,
            analysisHistory.id,
            expect.anything()
        );
        expect(result.rowsDeleted).toBe(2);
    });

    it('clears prompt_dynamic (only) on surviving rows past the 7-day prompt-retention cutoff, leaving hash columns untouched', async () => {
        const { db, spies } = makePruneDb({
            clearedHistoryIds: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        });
        const repository = new DrizzleAnalysisHistoryRepository(db);

        const result = await repository.pruneAnalysisHistory(NOW);

        const expectedPromptCutoff = new Date(
            NOW.getTime() - PROMPT_DYNAMIC_RETENTION_DAYS * MS_PER_DAY
        );
        expect(ltSpy).toHaveBeenNthCalledWith(
            2,
            analysisHistory.generatedAt,
            expectedPromptCutoff
        );
        expect(isNotNullSpy).toHaveBeenCalledWith(
            analysisHistory.promptDynamic
        );
        expect(spies.updateFn).toHaveBeenCalledWith(analysisHistory);
        // Only promptDynamic is set — promptStableHash/promptSystemHash/
        // promptVersion must never appear in this payload (schema.ts +
        // pruneAnalysisHistory JSDoc: they stay intact after the sweep).
        expect(spies.historySet).toHaveBeenCalledWith({ promptDynamic: null });
        expect(spies.historySet).toHaveBeenCalledWith(
            expect.not.objectContaining({
                promptStableHash: expect.anything(),
                promptSystemHash: expect.anything(),
                promptVersion: expect.anything(),
            })
        );
        expect(result.promptsCleared).toBe(3);
    });

    it('sweeps only blobs unreferenced by both prompt_stable_hash and prompt_system_hash, after the row delete/prompt clear', async () => {
        const { db, spies } = makePruneDb({
            deletedBlobHashes: [{ hash: 'orphan-1' }],
        });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await repository.pruneAnalysisHistory(NOW);

        expect(notExistsSpy).toHaveBeenCalledTimes(2);
        expect(eqSpy).toHaveBeenCalledWith(
            analysisHistory.promptStableHash,
            analysisPromptBlobs.hash
        );
        expect(eqSpy).toHaveBeenCalledWith(
            analysisHistory.promptSystemHash,
            analysisPromptBlobs.hash
        );
        expect(spies.deleteFn).toHaveBeenCalledWith(analysisPromptBlobs);
        expect(inArraySpy).toHaveBeenNthCalledWith(
            3,
            analysisPromptBlobs.hash,
            expect.anything()
        );
        expect(spies.blobReturning).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '0 row(s) deleted, 0 prompt(s) cleared, 1 orphan blob(s) deleted'
            )
        );

        logSpy.mockRestore();
    });

    /**
     * ORPHAN_BLOB_MIN_AGE_MS — the race guard. `makePruneDb`'s chain is
     * driver-free (see its JSDoc above): nothing here can literally run a
     * blob's `firstSeenAt` through Postgres's `<` operator. What we CAN
     * prove, the same way every other cutoff in this describe block is
     * proven (`resultCutoff`/`promptCutoff` above), is that the guard is
     * wired as `lt(analysisPromptBlobs.firstSeenAt, now - ORPHAN_BLOB_MIN_AGE_MS)`
     * and ANDed into the same predicate as the two `notExists` checks —
     * given that, Postgres excluding a row with `firstSeenAt >= cutoff`
     * (a blob younger than the guard) and including one with
     * `firstSeenAt < cutoff` (older, still unreferenced) follows from the
     * operator's own semantics, not from anything this test file re-derives.
     */
    it('guards the orphan sweep with ORPHAN_BLOB_MIN_AGE_MS — a blob younger than the guard is excluded from the delete candidates even with no referencing row', async () => {
        const { db } = makePruneDb();
        const repository = new DrizzleAnalysisHistoryRepository(db);

        await repository.pruneAnalysisHistory(NOW);

        const expectedBlobAgeCutoff = new Date(
            NOW.getTime() - ORPHAN_BLOB_MIN_AGE_MS
        );
        // 3rd `lt` call overall — after resultCutoff (1st, keyed on
        // analysisHistory.generatedAt) and promptCutoff (2nd, same column) —
        // is the orphan-sweep age guard, keyed on `firstSeenAt` instead.
        expect(ltSpy).toHaveBeenNthCalledWith(
            3,
            analysisPromptBlobs.firstSeenAt,
            expectedBlobAgeCutoff
        );
        // The guard runs alongside, not instead of, the existing
        // reference checks.
        expect(notExistsSpy).toHaveBeenCalledTimes(2);
    });

    it('still deletes an unreferenced blob once it clears the age guard', async () => {
        const { db, spies } = makePruneDb({
            deletedBlobHashes: [{ hash: 'old-orphan' }],
        });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await repository.pruneAnalysisHistory(NOW);

        expect(spies.deleteFn).toHaveBeenCalledWith(analysisPromptBlobs);
        expect(spies.blobReturning).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('1 orphan blob(s) deleted')
        );

        logSpy.mockRestore();
    });

    it('never throws on a DB failure and returns zeroed counts', async () => {
        const { db } = makePruneDb({ rejectAt: 'deleteHistory' });
        const repository = new DrizzleAnalysisHistoryRepository(db);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(repository.pruneAnalysisHistory(NOW)).resolves.toEqual({
            rowsDeleted: 0,
            promptsCleared: 0,
        });

        expect(consoleError).toHaveBeenCalledWith(
            '[analysisHistoryRepository] pruneAnalysisHistory failed:',
            expect.any(Error)
        );
        consoleError.mockRestore();
    });

    it('defaults `now` to the current time when omitted', async () => {
        const { db } = makePruneDb();
        const repository = new DrizzleAnalysisHistoryRepository(db);

        await expect(repository.pruneAnalysisHistory()).resolves.toEqual({
            rowsDeleted: 0,
            promptsCleared: 0,
        });
    });
});
