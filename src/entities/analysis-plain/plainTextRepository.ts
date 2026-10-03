import 'server-only';
import { and, eq } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { analysisPlainTexts } from '@/shared/db/schema';
import type { PlainTextRepository, SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * `analysis_plain_texts`를 읽고 쓰는 Drizzle repository.
 *
 * 읽기는 재시도하지 않는다 — 생성 앞단의 크리티컬 패스이고, 실패는 호출자가 캐시
 * 미스로 취급한다. 쓰기는 fire-and-forget이라 `DB_TRANSIENT_RETRY`로 일시 장애를
 * 흡수한다. `ON CONFLICT DO NOTHING`이라 재시도해도 멱등이다.
 *
 * @param db - Drizzle-wrapped database client; obtain via `tryGetDatabaseClient`.
 */
export class DrizzlePlainTextRepository implements PlainTextRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async find(
        promptVersion: string,
        locale: string,
        inputDigest: string
    ): Promise<string | null> {
        const [row] = await this.db
            .select({ text: analysisPlainTexts.text })
            .from(analysisPlainTexts)
            .where(
                and(
                    eq(analysisPlainTexts.promptVersion, promptVersion),
                    eq(analysisPlainTexts.locale, locale),
                    eq(analysisPlainTexts.inputDigest, inputDigest)
                )
            )
            .limit(1);

        return row?.text ?? null;
    }

    async insert(
        promptVersion: string,
        locale: string,
        inputDigest: string,
        text: string
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(analysisPlainTexts)
                    .values({
                        promptVersion,
                        locale,
                        inputDigest,
                        text,
                    })
                    .onConflictDoNothing({
                        target: [
                            analysisPlainTexts.promptVersion,
                            analysisPlainTexts.locale,
                            analysisPlainTexts.inputDigest,
                        ],
                    }),
            DB_TRANSIENT_RETRY
        );
    }
}
