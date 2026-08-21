import 'server-only';

import { eq } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { sharedAnalyses } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { Tier } from '@y0ngha/siglens-core';
import type { SharedAnalysisSnapshot } from './types';
import type { Locale } from '@/shared/i18n/locales';
import {
    LEGACY_CONTENT_LOCALE,
    toContentLocale,
} from '@/shared/db/contentLocale';

export interface SharedAnalysisRow {
    snapshotJson: unknown;
    createdAt: Date;
    expiresAt: Date;
    /**
     * 스냅샷 본문의 언어. 마이그레이션 전 행은 전부 한국어이므로
     * `LEGACY_CONTENT_LOCALE`로 읽는다.
     *
     * 뷰어가 이 값을 알아야 "이 공유는 한국어로 생성됐습니다" 안내를 띄우거나
     * `<html lang>`을 맞출 수 있다 — 현재 화면은 쓰지 않지만, 읽기 계약에
     * 넣어 두지 않으면 나중에 또 컬럼만 있고 아무도 안 읽는 상태가 된다.
     */
    locale: Locale;
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
    /** 생성 시점의 로케일 — 저장된 본문이 그 언어로 만들어졌다. */
    locale: Locale;
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
                        // 플래그로 가리지 않는다. Drizzle은 스키마에 있는 컬럼을
                        // 값에서 빼도 `default`로 **항상 INSERT에 넣는다**
                        // (실측: `values({...}).toSQL()`) — 즉 플래그 분기로는
                        // 마이그레이션 전 배포를 보호할 수 없다. 보호는 배포
                        // 순서가 한다: 스키마 먼저, 코드 나중(expand/contract).
                        locale: record.locale,
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
                        locale: sharedAnalyses.locale,
                    })
                    .from(sharedAnalyses)
                    .where(eq(sharedAnalyses.id, id))
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        const row = rows[0];
        if (row === undefined) return null;
        return {
            snapshotJson: row.snapshotJson,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            // 백필 전 행이나 수기 SQL이 알 수 없는 값을 들고 있으면 레거시 로케일.
            locale: toContentLocale(row.locale) ?? LEGACY_CONTENT_LOCALE,
        };
    }
}
