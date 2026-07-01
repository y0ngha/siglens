import 'server-only';

import { eq } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { sharedAnalyses } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { Tier } from '@y0ngha/siglens-core';
import type { SharedAnalysisSnapshot } from './types';

export interface SharedAnalysisRow {
    snapshotJson: unknown;
    createdAt: Date;
    expiresAt: Date;
}

export interface CreateRecord {
    id: string;
    kind: SharedAnalysisSnapshot['kind'];
    symbol: string;
    contentHash: string;
    snapshot: SharedAnalysisSnapshot;
    sharerTier: Tier;
    userId: string | null;
    expiresAt: Date;
}

export interface SharedAnalysisRepository {
    create(record: CreateRecord): Promise<string>;
    findById(id: string): Promise<SharedAnalysisRow | null>;
}

export class DrizzleSharedAnalysisRepository implements SharedAnalysisRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Inserts a new shared-analysis row, or — if the same content_hash already
     * exists — updates expiresAt and returns the existing id (dedupe path).
     *
     * A single `INSERT … ON CONFLICT DO UPDATE … RETURNING { id }` statement
     * handles both paths atomically, so callers always get the canonical id back
     * regardless of whether the row was new or a duplicate.
     *
     * Wrapped in withRetry(NEON_TRANSIENT_RETRY) to absorb transient Neon HTTP
     * driver failures (e.g. admin_shutdown, fetch failed) without surfacing them
     * to the action layer.
     *
     * Retry safety: `record.id` is a fresh random token generated once per
     * action call (in generateShareId, before this method is invoked), so a
     * retry cannot produce a duplicate PK for the same logical request. The
     * ON CONFLICT on content_hash is the realistic dup-prevention path (same
     * analysis shared twice). A PK collision on retry is theoretically possible
     * but vanishingly unlikely (crypto-random 21-char nanoid); accepted as a
     * known, low-risk window rather than adding retry-level ID regeneration.
     */
    async create(record: CreateRecord): Promise<string> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(sharedAnalyses)
                    .values({
                        id: record.id,
                        userId: record.userId,
                        kind: record.kind,
                        symbol: record.symbol,
                        contentHash: record.contentHash,
                        snapshotJson: record.snapshot,
                        sharerTier: record.sharerTier,
                        expiresAt: record.expiresAt,
                    })
                    .onConflictDoUpdate({
                        target: sharedAnalyses.contentHash,
                        set: { expiresAt: record.expiresAt },
                    })
                    .returning({ id: sharedAnalyses.id }),
            NEON_TRANSIENT_RETRY
        );
        return row!.id;
    }

    async findById(id: string): Promise<SharedAnalysisRow | null> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        snapshotJson: sharedAnalyses.snapshotJson,
                        createdAt: sharedAnalyses.createdAt,
                        expiresAt: sharedAnalyses.expiresAt,
                    })
                    .from(sharedAnalyses)
                    .where(eq(sharedAnalyses.id, id))
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        return rows[0] ?? null;
    }
}
