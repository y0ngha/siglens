import 'server-only';

import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { chatConversations, chatMessages } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { Locale } from '@/shared/i18n/locales';
import {
    deriveTitle,
    CONVERSATION_LIST_LIMIT,
    type ChatConversationRecord,
    type ChatMessageRecord,
    type NewChatMessage,
} from './model';

/**
 * Postgres `uuid` columns 22P02 (invalid_text_representation) on a
 * malformed literal — this repository is a common landing spot for
 * attacker- or client-bug-controlled ids (URL segments, action args), so
 * every id-taking method below validates shape *before* touching the DB
 * instead of letting a raw driver error surface as a 500.
 */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
    return UUID_RE.test(id);
}

/**
 * Drizzle ORM implementation backing SiglensAI conversations/messages
 * (spec §6-1).
 *
 * Conversation methods (`create`/`findForUser`/`listForUser`/`countForUser`/
 * `rename`/`softDelete`) are owner-scoped: every query filters by `userId`
 * in the SQL `WHERE` clause itself — never post-fetch-and-check — so a
 * stray row from another user can never leak through even under a future
 * refactor.
 *
 * **Message methods (`listMessages`, `appendMessages`,
 * `supersedeAfterLastUser`, `deleteFromSeq`) take a bare `conversationId`
 * and are NOT owner-scoped** — they trust the caller already resolved and
 * authorized that id. Every caller MUST first confirm ownership via
 * `findForUser(id, userId)` (returning null on any mismatch) before calling
 * one of these; skipping that check lets one user read or mutate another
 * user's messages by id alone.
 */
export class DrizzleChatConversationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Inserts a new conversation. Not retried — an INSERT with a
     * server-generated `id` is not idempotent, so retrying after a lost
     * response (network drop after the write commits) would create a
     * duplicate conversation.
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

    /** Owner-scoped; null for other users' or deleted conversations, and for a malformed (non-UUID) `id` — no query is issued in that case. */
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
                            eq(chatConversations.userId, userId),
                            isNull(chatConversations.deletedAt)
                        )
                    )
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        return (row as ChatConversationRecord | undefined) ?? null;
    }

    /**
     * Owner-scoped conversation list, most-recent first, capped at
     * {@link CONVERSATION_LIST_LIMIT}.
     */
    async listForUser(
        userId: string,
        limit = CONVERSATION_LIST_LIMIT
    ): Promise<ChatConversationRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select()
                    .from(chatConversations)
                    .where(
                        and(
                            eq(chatConversations.userId, userId),
                            isNull(chatConversations.deletedAt)
                        )
                    )
                    .orderBy(desc(chatConversations.lastMessageAt))
                    .limit(limit),
            NEON_TRANSIENT_RETRY
        ) as Promise<ChatConversationRecord[]>;
    }

    /** Owner-scoped count of live (non-deleted) conversations. */
    async countForUser(userId: string): Promise<number> {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(chatConversations)
            .where(
                and(
                    eq(chatConversations.userId, userId),
                    isNull(chatConversations.deletedAt)
                )
            );
        return Number(row?.count ?? 0);
    }

    /**
     * Renames the conversation, scoped to the owner and to live (non-deleted)
     * rows — a soft-deleted conversation cannot be un-deleted by renaming
     * it. No-ops for a malformed `id` (same effect as the id simply not
     * matching any row).
     */
    async rename(id: string, userId: string, title: string): Promise<void> {
        if (!isValidUuid(id)) return;
        await this.db
            .update(chatConversations)
            .set({ title: title.slice(0, 120), updatedAt: new Date() })
            .where(
                and(
                    eq(chatConversations.id, id),
                    eq(chatConversations.userId, userId),
                    isNull(chatConversations.deletedAt)
                )
            );
    }

    /**
     * Soft-deletes the conversation, scoped to the owner and to live rows —
     * this makes repeated calls idempotent (a second delete matches zero
     * rows instead of re-stamping `deleted_at`). No-ops for a malformed
     * `id`.
     */
    async softDelete(id: string, userId: string): Promise<void> {
        if (!isValidUuid(id)) return;
        await this.db
            .update(chatConversations)
            .set({ deletedAt: new Date() })
            .where(
                and(
                    eq(chatConversations.id, id),
                    eq(chatConversations.userId, userId),
                    isNull(chatConversations.deletedAt)
                )
            );
    }

    /**
     * NOT owner-scoped — see the class doc. Returns `[]` for a malformed
     * `conversationId` without querying.
     */
    async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
        if (!isValidUuid(conversationId)) return [];
        return withRetry(
            () =>
                this.db
                    .select()
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conversationId))
                    .orderBy(chatMessages.seq),
            NEON_TRANSIENT_RETRY
        ) as Promise<ChatMessageRecord[]>;
    }

    /**
     * NOT owner-scoped — see the class doc. One INSERT whose `seq` values
     * are `(select coalesce(max(seq),0) …) + n` — evaluated inside the
     * statement, so no transaction is needed (neon-http has none).
     * Cross-request races are excluded by the per-user turn lock.
     *
     * Not retried: like `create`, an INSERT of new message rows is not
     * idempotent — retrying after a lost response would duplicate the
     * turn's messages. Returns `[]` without touching the DB for an empty
     * `messages` array or a malformed `conversationId`.
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
        // Recomputed from a COUNT rather than incremented — this makes the
        // statement idempotent (safe to retry after a lost response) and
        // self-healing against any prior drift, unlike `messageCount + n`
        // which would double-count on a retried call.
        //
        // The messages themselves are already committed at this point — if
        // this update still fails after its own retries, the turn must not
        // be reported as failed (that would make the caller retry and
        // duplicate the just-inserted rows). We swallow the error and return
        // the inserted messages; the next `appendMessages` call recomputes
        // `message_count`/`last_message_at` from scratch and self-heals.
        try {
            await withRetry(
                () =>
                    this.db
                        .update(chatConversations)
                        .set({
                            messageCount: sql`(select count(*) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId})`,
                            lastMessageAt: new Date(),
                            updatedAt: new Date(),
                        })
                        .where(eq(chatConversations.id, conversationId)),
                NEON_TRANSIENT_RETRY
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
     * NOT owner-scoped — see the class doc. regenerate: rows after the last
     * user row → superseded. Returns that user row's seq, or `null` (also
     * for a malformed `conversationId`, without querying).
     */
    async supersedeAfterLastUser(
        conversationId: string
    ): Promise<number | null> {
        if (!isValidUuid(conversationId)) return null;
        const rows = await this.listMessages(conversationId);
        const lastUser = [...rows].reverse().find(r => r.role === 'user');
        if (!lastUser) return null;
        await this.db
            .update(chatMessages)
            .set({ status: 'superseded' })
            .where(
                and(
                    eq(chatMessages.conversationId, conversationId),
                    gte(chatMessages.seq, lastUser.seq + 1)
                )
            );
        return lastUser.seq;
    }

    /**
     * NOT owner-scoped — see the class doc. edit: hard-delete from `seq`
     * (the edited user row) onward and recount. No-ops for a malformed
     * `conversationId`.
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
        // Same idempotent COUNT recompute as `appendMessages` — no separate
        // SELECT-then-write-back round trip, and no risk of the two steps
        // observing different data under concurrent writes.
        await this.db
            .update(chatConversations)
            .set({
                messageCount: sql`(select count(*) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId})`,
                updatedAt: new Date(),
            })
            .where(eq(chatConversations.id, conversationId));
    }
}
