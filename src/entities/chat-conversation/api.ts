import 'server-only';

import { and, desc, eq, gte, max, sql, type SQL } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { chatConversations, chatMessages } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import {
    CONVERSATION_LIST_LIMIT,
    CONVERSATION_TITLE_COLUMN_MAX,
    deriveTitle,
    type ChatConversationRecord,
    type ChatMessageRecord,
    type NewChatMessage,
} from './model';

/**
 * Postgres `uuid` 컬럼은 형식이 틀린 리터럴에 22P02(invalid_text_representation)를 던진다.
 * 이 저장소는 URL 세그먼트·액션 인자처럼 공격자나 클라이언트 버그가 정하는 id를 받는 자리라,
 * id를 받는 모든 메서드가 DB에 가기 전에 형식을 검사해 드라이버 오류가 500으로 새지 않게 한다.
 */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
    return UUID_RE.test(id);
}

/** `chat_messages` 행 수로 `message_count`를 다시 계산하는 서브쿼리. 증분(`+ n`)이 아니라 재계산이라 재시도에 멱등이고 기존 어긋남도 스스로 복구된다. */
function messageCountSql(conversationId: string): SQL {
    return sql`(select count(*) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId})`;
}

/**
 * SIGLENS AI 대화·메시지의 Drizzle 저장소.
 *
 * 대화 메서드(`create`/`findForUser`/`listForUser`/`countForUser`/`rename`/`delete`)는
 * 소유자 범위다: 조회 후 검사가 아니라 SQL `WHERE`에서 `userId`로 걸러, 훗날 리팩터링에도
 * 다른 사용자의 행이 새지 않는다.
 *
 * **메시지 메서드(`listMessages`, `appendMessages`, `supersedeAfterLastUser`,
 * `deleteFromSeq`)는 `conversationId`만 받으며 소유자 범위가 아니다** — 호출자가 이미 그 id를
 * 확인·인가했다고 신뢰한다. 호출자는 반드시 먼저 `findForUser(id, userId)`로 소유를 확인해야 한다
 * (불일치는 null). 건너뛰면 id만으로 남의 메시지를 읽거나 바꿀 수 있다.
 */
export class DrizzleChatConversationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 새 대화를 만든다. 재시도하지 않는다 — 서버가 `id`를 생성하는 INSERT는 멱등이 아니라서,
     * 커밋 뒤 응답이 유실된 상태로 재시도하면 대화가 중복된다.
     */
    async create(input: {
        userId: string;
        firstMessage: string;
        locale: Locale;
        modelId: string;
    }): Promise<ChatConversationRecord> {
        const [row] = await this.db
            .insert(chatConversations)
            .values({
                userId: input.userId,
                title: deriveTitle(input.firstMessage, input.locale),
                locale: input.locale,
                modelId: input.modelId,
                lastMessageAt: new Date(),
            })
            .returning();
        return row as ChatConversationRecord;
    }

    /** 소유자 범위 조회. 타인의 대화·이미 삭제된 대화·UUID 형식이 아닌 `id`면 null이고, 형식 오류는 쿼리를 보내지 않는다. */
    async findForUser(
        id: string,
        userId: string
    ): Promise<ChatConversationRecord | null> {
        if (!isValidUuid(id)) return null;
        const [row] = await withRetry(
            () =>
                this.db
                    .select()
                    .from(chatConversations)
                    .where(
                        and(
                            eq(chatConversations.id, id),
                            eq(chatConversations.userId, userId)
                        )
                    )
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return (row as ChatConversationRecord | undefined) ?? null;
    }

    /** 소유자 범위 대화 목록. 최근 순이며 {@link CONVERSATION_LIST_LIMIT}건까지. 일시 DB 오류는 재시도한다. */
    async listForUser(
        userId: string,
        limit = CONVERSATION_LIST_LIMIT
    ): Promise<ChatConversationRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select()
                    .from(chatConversations)
                    .where(eq(chatConversations.userId, userId))
                    .orderBy(desc(chatConversations.lastMessageAt))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        ) as Promise<ChatConversationRecord[]>;
    }

    /** 소유자 범위 대화 수. 재시도하지 않는다. */
    async countForUser(userId: string): Promise<number> {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(chatConversations)
            .where(eq(chatConversations.userId, userId));
        return Number(row?.count ?? 0);
    }

    /** 소유자 범위로 제목을 바꾼다. 형식이 틀린 `id`는 일치하는 행이 없는 것과 같게 no-op이다. */
    async rename(id: string, userId: string, title: string): Promise<void> {
        if (!isValidUuid(id)) return;
        await this.db
            .update(chatConversations)
            .set({
                title: title.slice(0, CONVERSATION_TITLE_COLUMN_MAX),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(chatConversations.id, id),
                    eq(chatConversations.userId, userId)
                )
            );
    }

    /**
     * 소유자 범위 하드 삭제. `chat_messages.conversation_id`가 `onDelete: 'cascade'`라 같은
     * 문장으로 대화록 전체(메시지 본문·시장 데이터·논의된 보유 종목 포함)가 지워지며 별도
     * 후속 작업은 없다. 일치하는 행이 없으면(없는 id·타인의 id·이미 삭제) 조용한 no-op이라
     * 반복 호출도 멱등이다. 형식이 틀린 `id`는 DB에 가지 않고 no-op이다.
     *
     * 개인정보 처리방침(`db/seeds/terms/privacy/v4.md`)이 사용자 삭제 시 즉시 파기를 약속하므로
     * soft-delete 플래그가 아니라 실제 `DELETE`여야 한다.
     */
    async delete(id: string, userId: string): Promise<void> {
        if (!isValidUuid(id)) return;
        await this.db
            .delete(chatConversations)
            .where(
                and(
                    eq(chatConversations.id, id),
                    eq(chatConversations.userId, userId)
                )
            );
    }

    /** 소유자 범위가 아니다(클래스 문서 참고). 형식이 틀린 `conversationId`는 쿼리 없이 `[]`. 일시 DB 오류는 재시도한다. */
    async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
        if (!isValidUuid(conversationId)) return [];
        return withRetry(
            () =>
                this.db
                    .select()
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conversationId))
                    .orderBy(chatMessages.seq),
            DB_TRANSIENT_RETRY
        ) as Promise<ChatMessageRecord[]>;
    }

    /**
     * 소유자 범위가 아니다(클래스 문서 참고). `seq`를 `(select coalesce(max(seq),0) …) + n`으로
     * 한 INSERT 안에서 매기므로 트랜잭션이 필요 없다. 요청 간 경합은 사용자별 턴 락이 막는다.
     *
     * INSERT는 재시도하지 않는다 — `create`처럼 멱등이 아니라서 응답 유실 뒤 재시도하면 턴의
     * 메시지가 중복된다. 빈 `messages`나 형식이 틀린 `conversationId`는 DB에 가지 않고 `[]`.
     */
    async appendMessages(
        conversationId: string,
        messages: readonly NewChatMessage[]
    ): Promise<ChatMessageRecord[]> {
        if (messages.length === 0 || !isValidUuid(conversationId)) return [];
        const base = sql<number>`(select coalesce(max(${chatMessages.seq}), 0) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId})`;
        const rows = messages.map((m, i) => ({
            conversationId,
            seq: sql<number>`${base} + ${i + 1}`,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls ?? null,
            toolCallId: m.toolCallId ?? null,
            toolName: m.toolName ?? null,
            modelId: m.modelId ?? null,
            usage: m.usage ?? null,
            status: m.status ?? 'complete',
        }));
        const inserted = await this.db
            .insert(chatMessages)
            .values(rows)
            .returning();
        // 메시지는 이미 커밋됐다. 카운터 갱신이 재시도 후에도 실패했을 때 턴을 실패로 알리면
        // 호출자가 재시도해 방금 넣은 행이 중복되므로, 오류를 삼키고 삽입된 메시지를 돌려준다.
        // 다음 `appendMessages`가 `message_count`/`last_message_at`을 처음부터 다시 계산해 복구한다.
        try {
            await withRetry(
                () =>
                    this.db
                        .update(chatConversations)
                        .set({
                            messageCount: messageCountSql(conversationId),
                            lastMessageAt: new Date(),
                            updatedAt: new Date(),
                        })
                        .where(eq(chatConversations.id, conversationId)),
                DB_TRANSIENT_RETRY
            );
        } catch {
            console.error(
                '[DrizzleChatConversationRepository.appendMessages] counter update failed after retries',
                conversationId
            );
        }
        return inserted as ChatMessageRecord[];
    }

    /**
     * 소유자 범위가 아니다(클래스 문서 참고). regenerate: 마지막 user 행 뒤의 행을 superseded로
     * 바꾸고 그 user 행의 seq를 돌려준다. user 행이 없거나 `conversationId` 형식이 틀리면
     * `null`(형식 오류는 쿼리 없이). superseded가 된 user 행도 "마지막 user"로 센다.
     */
    async supersedeAfterLastUser(
        conversationId: string
    ): Promise<number | null> {
        if (!isValidUuid(conversationId)) return null;
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ seq: max(chatMessages.seq) })
                    .from(chatMessages)
                    .where(
                        and(
                            eq(chatMessages.conversationId, conversationId),
                            eq(chatMessages.role, 'user')
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        const lastUserSeq = row?.seq ?? null;
        if (lastUserSeq === null) return null;
        await this.db
            .update(chatMessages)
            .set({ status: 'superseded' })
            .where(
                and(
                    eq(chatMessages.conversationId, conversationId),
                    gte(chatMessages.seq, lastUserSeq + 1)
                )
            );
        return lastUserSeq;
    }

    /**
     * 소유자 범위가 아니다(클래스 문서 참고). edit: `seq`(편집한 user 행)부터 뒤를 하드 삭제하고
     * `message_count`를 다시 센다. 형식이 틀린 `conversationId`는 no-op.
     */
    async deleteFromSeq(conversationId: string, seq: number): Promise<void> {
        if (!isValidUuid(conversationId)) return;
        await this.db
            .delete(chatMessages)
            .where(
                and(
                    eq(chatMessages.conversationId, conversationId),
                    gte(chatMessages.seq, seq)
                )
            );
        // 삭제와 재계산을 한 문장으로 묶지 못하지만, 재계산이 COUNT라 동시 쓰기가 있어도 마지막
        // 실행이 항상 현재 행 수로 수렴한다.
        await this.db
            .update(chatConversations)
            .set({
                messageCount: messageCountSql(conversationId),
                updatedAt: new Date(),
            })
            .where(eq(chatConversations.id, conversationId));
    }
}
