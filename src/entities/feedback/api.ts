import 'server-only';

import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { feedback } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    AiFeedbackPatch,
    CreateFeedbackRecord,
    FeedbackDigestRow,
    FeedbackRepository,
} from './lib/types';

/** 일일 요약 조회 상한. 하루 몇 천 건이어도 가벼운 컬럼만 읽지만, 폭주 때 메모리를 보호한다. */
const DIGEST_ROW_LIMIT = 20_000;

/** Drizzle 기반 {@link FeedbackRepository} 구현. 액션·크론이 요청마다 생성한다. */
export class DrizzleFeedbackRepository implements FeedbackRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async create(record: CreateFeedbackRecord): Promise<string> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(feedback)
                    .values({
                        kind: record.kind,
                        surface: record.surface,
                        rating: record.rating,
                        vote: record.vote,
                        reasons: record.reasons,
                        comment: record.comment,
                        targetType: record.targetType,
                        symbol: record.symbol,
                        context: record.context,
                        snapshot: record.snapshot,
                        userId: record.userId,
                        conversationId: record.conversationId,
                        pagePath: record.pagePath,
                        locale: record.locale,
                    })
                    .returning({ id: feedback.id }),
            DB_TRANSIENT_RETRY
        );
        if (!row) throw new Error('feedback insert returned no row');
        return row.id;
    }

    /**
     * `kind='ai_response'` 행만 갱신한다 — VOC 행이 이 경로로 바뀌면 안 된다.
     * 방향(`vote`)을 함께 바꾸지 않고 사유·의견만 덧붙이는 패치는 현재 👎인 행에만
     * 적용한다(👍 행에 사유가 붙는 모순 방지).
     * id 형식 오류(22P02)는 호출부(검증)가 먼저 걸러 이 메서드에 오지 않는다.
     */
    async updateAiFeedback(
        id: string,
        patch: AiFeedbackPatch,
        ownerUserId: string | null
    ): Promise<boolean> {
        const set: Partial<typeof feedback.$inferInsert> = {};
        if (patch.vote !== undefined) set.vote = patch.vote;
        if (patch.reasons !== undefined) set.reasons = patch.reasons;
        if (patch.comment !== undefined) set.comment = patch.comment;
        if (Object.keys(set).length === 0) return false;

        const detailOnly =
            patch.vote === undefined &&
            (patch.reasons !== undefined || patch.comment !== undefined);
        const where = and(
            eq(feedback.id, id),
            eq(feedback.kind, 'ai_response'),
            // id만으로 남의 평가를 고치지 못하게 행 소유자를 묶는다. 비회원 행은 비회원끼리만
            // 구분할 수 없지만(식별자를 저장하지 않는다) 회원 행은 그 회원만 고칠 수 있다.
            ownerUserId === null
                ? isNull(feedback.userId)
                : eq(feedback.userId, ownerUserId),
            detailOnly ? eq(feedback.vote, 'down') : undefined
        );
        const rows = await withRetry(
            () =>
                this.db
                    .update(feedback)
                    .set(set)
                    .where(where)
                    .returning({ id: feedback.id }),
            DB_TRANSIENT_RETRY
        );
        return rows.length > 0;
    }

    async listAiFeedbackSince(since: Date): Promise<FeedbackDigestRow[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        surface: feedback.surface,
                        vote: feedback.vote,
                        reasons: feedback.reasons,
                        comment: feedback.comment,
                        targetType: feedback.targetType,
                        symbol: feedback.symbol,
                        createdAt: feedback.createdAt,
                    })
                    .from(feedback)
                    .where(
                        and(
                            eq(feedback.kind, 'ai_response'),
                            gte(feedback.createdAt, since)
                        )
                    )
                    .orderBy(desc(feedback.createdAt))
                    .limit(DIGEST_ROW_LIMIT),
            DB_TRANSIENT_RETRY
        );
    }

    async deleteOlderThan(before: Date): Promise<number> {
        const rows = await withRetry(
            () =>
                this.db
                    .delete(feedback)
                    .where(lt(feedback.createdAt, before))
                    .returning({ id: feedback.id }),
            DB_TRANSIENT_RETRY
        );
        return rows.length;
    }
}
