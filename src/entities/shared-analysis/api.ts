import 'server-only';

import type { Tier } from '@y0ngha/siglens-core';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { MS_PER_DAY } from '@/shared/config/time';
import {
    LEGACY_CONTENT_LOCALE,
    toContentLocale,
} from '@/shared/db/contentLocale';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { sharedAnalyses } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import type { SharedAnalysisSnapshot } from './types';

/** `findById`가 돌려주는 행. 만료·스냅샷 형태 판정은 호출부(`getSharedAnalysisAction`)가 한다. */
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

/** `create`가 INSERT할 행. `id`는 호출당 한 번 만든 랜덤 토큰이다. */
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

/**
 * 만료 후 이 일수가 지나야 행을 지운다.
 *
 * 만료 직후에 바로 지우지 않는 이유: 만료된 공유 링크는 "만료됨" 화면을 보여 준다
 * (`getSharedAnalysisAction`의 `expired`). 행이 없으면 같은 링크가 "없는 공유"(not_found)로
 * 바뀌어, 며칠 전 받은 링크를 연 사람이 링크가 깨졌다고 오해한다. 30일이면 메신저에
 * 돌던 링크가 대부분 식는다.
 */
export const SHARED_ANALYSIS_PURGE_GRACE_DAYS = 30;

/**
 * {@link DrizzleSharedAnalysisRepository.pruneExpired} 한 번이 지우는 최대 행 수.
 * `id IN (SELECT … LIMIT N)` 캡 — 남은 몫은 다음 seo-prewarm tick이 이어서 지운다.
 */
export const SHARED_ANALYSIS_PRUNE_BATCH_SIZE = 500;

interface SharedAnalysisRepository {
    create(record: CreateRecord): Promise<string>;
    findById(id: string): Promise<SharedAnalysisRow | null>;
}

/** `shared_analyses` 테이블 접근. server-only라 같은 entity의 액션과 app 크론(`pruneExpiredRows`)만 쓴다. */
export class DrizzleSharedAnalysisRepository implements SharedAnalysisRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 새 공유 행을 넣거나, 같은 content_hash가 이미 있으면 `expiresAt`만 갱신하고
     * 기존 id를 돌려준다(dedupe 경로).
     *
     * `INSERT … ON CONFLICT DO UPDATE … RETURNING { id }` 한 문장이 두 경로를 원자적으로
     * 처리하므로, 새 행이든 중복이든 호출자는 항상 정본 id를 받는다.
     *
     * `withRetry(DB_TRANSIENT_RETRY)`로 일시적 DB 장애(admin_shutdown, CONNECTION_CLOSED)를
     * 액션 계층에 노출하지 않고 흡수한다.
     *
     * 재시도 안전성: `record.id`는 액션 호출당 한 번(generateShareId) 만든 랜덤 토큰이라
     * 재시도가 같은 논리 요청에 중복 PK를 만들지 않는다. 현실적인 중복 방지 경로는
     * content_hash의 ON CONFLICT(같은 분석을 두 번 공유)다. 재시도 중 PK 충돌은 이론상
     * 가능하지만 암호학적 난수 128비트라 사실상 0이어서, 재시도 단위 id 재생성은 두지 않는다.
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
            DB_TRANSIENT_RETRY
        );
        if (row === undefined) {
            throw new Error('shared_analyses upsert returned no row');
        }
        return row.id;
    }

    /**
     * 만료 후 {@link SHARED_ANALYSIS_PURGE_GRACE_DAYS}일이 지난 행을 최대
     * {@link SHARED_ANALYSIS_PRUNE_BATCH_SIZE}개 지우고 지운 수를 반환한다.
     * `WHERE expires_at < cutoff`는 `shared_analyses_expires_at_idx`를 탄다.
     *
     * 바깥 DELETE에도 만료 조건을 **다시** 건다. `create`의 dedupe 경로
     * (`ON CONFLICT … SET expires_at`)가 서브쿼리와 DELETE 사이에 같은 행의 만료를
     * 연장할 수 있는데, 조건 없이 id로만 지우면 방금 다시 공유된 행이 지워지고
     * `create`가 돌려준 id가 not_found가 된다. Postgres는 READ COMMITTED에서 동시
     * 갱신된 행의 WHERE를 재평가하므로 바깥 조건이 그 행을 건너뛴다.
     */
    async pruneExpired(now: Date = new Date()): Promise<number> {
        const cutoff = new Date(
            now.getTime() - SHARED_ANALYSIS_PURGE_GRACE_DAYS * MS_PER_DAY
        );
        const expiredIds = this.db
            .select({ id: sharedAnalyses.id })
            .from(sharedAnalyses)
            .where(lt(sharedAnalyses.expiresAt, cutoff))
            .limit(SHARED_ANALYSIS_PRUNE_BATCH_SIZE);

        const deleted = await withRetry(
            () =>
                this.db
                    .delete(sharedAnalyses)
                    .where(
                        and(
                            inArray(sharedAnalyses.id, expiredIds),
                            lt(sharedAnalyses.expiresAt, cutoff)
                        )
                    )
                    .returning({ id: sharedAnalyses.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }

    /**
     * id로 한 행을 읽는다(만료 여부와 무관하게 반환). 없으면 null.
     * `locale` 컬럼이 알 수 없는 값이면 레거시 로케일로 읽는다.
     */
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
            DB_TRANSIENT_RETRY
        );
        const [row] = rows;
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
