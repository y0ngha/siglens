import type { Mock } from 'vitest';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleSharedAnalysisRepository,
    SHARED_ANALYSIS_PRUNE_BATCH_SIZE,
    SHARED_ANALYSIS_PURGE_GRACE_DAYS,
} from '@/entities/shared-analysis/api';
import { createSqlCaptureDb } from '@/__tests__/utils/drizzleSqlCapture';
import { MS_PER_DAY } from '@/shared/config/time';
import type { SharedAnalysisSnapshot } from '@/entities/shared-analysis/types';

const snapshot = {
    kind: 'chart',
    symbol: 'AAPL',
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' },
    result: { trend: 'bullish' },
} as unknown as SharedAnalysisSnapshot;

function makeUpsertDb(returnedId: string): {
    db: SiglensDatabase;
    values: Mock;
} {
    const returning = vi.fn().mockResolvedValue([{ id: returnedId }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as SiglensDatabase, values };
}

function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleSharedAnalysisRepository', () => {
    describe('create', () => {
        it('inserts and returns the id', async () => {
            const { db } = makeUpsertDb('abc123');
            const repo = new DrizzleSharedAnalysisRepository(db);
            const id = await repo.create({
                id: 'abc123',
                kind: 'chart',
                symbol: 'AAPL',
                contentHash: 'h',
                snapshot,
                sharerTier: 'free',
                locale: 'ko',
                userId: null,
                expiresAt: new Date('2026-07-06T00:00:00Z'),
            });
            expect(id).toBe('abc123');
        });

        /**
         * Addendum C-2: dedupe path — when onConflictDoUpdate returns an
         * existing id (the INSERT conflicts on contentHash and Postgres returns
         * the already-stored row id), create() must forward that existing id.
         */
        it('returns the existing id when onConflictDoUpdate resolves with a pre-existing row', async () => {
            const { db } = makeUpsertDb('existing');
            const repo = new DrizzleSharedAnalysisRepository(db);
            const id = await repo.create({
                id: 'new-generated-id',
                kind: 'chart',
                symbol: 'AAPL',
                contentHash: 'h',
                snapshot,
                sharerTier: 'free',
                locale: 'ko',
                userId: null,
                expiresAt: new Date('2026-07-06T00:00:00Z'),
            });
            // The returning mock yields [{ id: 'existing' }], so create() must
            // return 'existing', not the id field on the record.
            expect(id).toBe('existing');
        });
    });

    describe('findById', () => {
        it('returns the row when present', async () => {
            const db = makeSelectDb([
                {
                    snapshotJson: snapshot,
                    createdAt: new Date(),
                    expiresAt: new Date('2026-07-06T00:00:00Z'),
                },
            ]);
            const repo = new DrizzleSharedAnalysisRepository(db);
            const row = await repo.findById('abc123');
            expect(row).not.toBeNull();
        });

        it('returns null when absent', async () => {
            const repo = new DrizzleSharedAnalysisRepository(makeSelectDb([]));
            expect(await repo.findById('nope')).toBeNull();
        });
    });

    describe('pruneExpired', () => {
        const NOW = new Date('2026-10-06T00:00:00.000Z');
        const CUTOFF = new Date(
            NOW.getTime() - SHARED_ANALYSIS_PURGE_GRACE_DAYS * MS_PER_DAY
        );

        it('만료 후 유예 기간이 지난 행만, 배치 상한 서브쿼리 + 바깥 만료 재확인으로 지운다', async () => {
            const { db, captured } = createSqlCaptureDb([{ id: 'a' }]);
            const repo = new DrizzleSharedAnalysisRepository(db);

            const deleted = await repo.pruneExpired(NOW);

            expect(deleted).toBe(1);
            expect(captured).toHaveLength(1);
            const { sql: text, params } = captured[0]!;
            const lower = text.toLowerCase();
            expect(lower).toMatch(/^delete from "shared_analyses"/);
            expect(lower).toContain(
                '"id" in (select "id" from "shared_analyses"'
            );
            // 서브쿼리와 바깥 DELETE 양쪽에 만료 조건 — 동시 재공유(만료 연장) 경합 차단.
            expect(
                lower.match(/"shared_analyses"\."expires_at" < \$\d/g)
            ).toHaveLength(2);
            expect(params).toContain(SHARED_ANALYSIS_PRUNE_BATCH_SIZE);
            // 유예 기간이 빠지면 막 만료된 링크가 "만료됨" 대신 not_found가 된다.
            expect(params.filter(p => p === CUTOFF.toISOString())).toHaveLength(
                2
            );
            expect(params).not.toContain(NOW.toISOString());
        });

        it('지울 행이 없으면 0을 반환한다', async () => {
            const { db } = createSqlCaptureDb([]);
            const repo = new DrizzleSharedAnalysisRepository(db);
            await expect(repo.pruneExpired(NOW)).resolves.toBe(0);
        });
    });
});
