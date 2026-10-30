import 'server-only';
import { inArray, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { economicIndicatorTranslations } from '@/shared/db/schema';
import type {
    IndicatorTranslationRecord,
    IndicatorTranslationRepository,
    IndicatorTranslationSource,
    SiglensDatabase,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const indicatorTranslationColumns = {
    normalizedName: economicIndicatorTranslations.normalizedName,
    koreanName: economicIndicatorTranslations.koreanName,
    source: economicIndicatorTranslations.source,
};

interface IndicatorTranslationRow {
    normalizedName: string;
    koreanName: string;
    source: string;
}

/** 읽기 경계에서 source를 검증 — 미지값은 'ai'로 흡수(캐시 행이므로 합리적 기본). */
function toSource(value: string): IndicatorTranslationSource {
    return value === 'dict' ? 'dict' : 'ai';
}

function toRecord(row: IndicatorTranslationRow): IndicatorTranslationRecord {
    return {
        normalizedName: row.normalizedName,
        koreanName: row.koreanName,
        source: toSource(row.source),
    };
}

/**
 * `economic_indicator_translations`를 읽고 쓰는 Drizzle repository.
 * `DrizzleAssetTranslationRepository` 미러 — onConflictDoUpdate는 schema의
 * `$onUpdateFn`을 트리거하지 않으므로 `updatedAt`을 `sql\`now()\``로 명시한다.
 */
export class DrizzleIndicatorTranslationRepository implements IndicatorTranslationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 정규화된 지표명 목록의 캐시 행을 읽는다. 빈 목록은 쿼리 없이 `[]`. */
    async findByNames(
        normalizedNames: readonly string[]
    ): Promise<IndicatorTranslationRecord[]> {
        if (normalizedNames.length === 0) return [];
        const rows = await withRetry(
            () =>
                this.db
                    .select(indicatorTranslationColumns)
                    .from(economicIndicatorTranslations)
                    .where(
                        inArray(economicIndicatorTranslations.normalizedName, [
                            ...normalizedNames,
                        ])
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.map(toRecord);
    }

    /** 지표명 기준 upsert — 같은 이름이면 번역·출처·`updatedAt`을 덮어쓴다. */
    async upsert(record: IndicatorTranslationRecord): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(economicIndicatorTranslations)
                    .values(record)
                    .onConflictDoUpdate({
                        target: economicIndicatorTranslations.normalizedName,
                        set: {
                            koreanName: sql`excluded.korean_name`,
                            source: sql`excluded.source`,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }
}
