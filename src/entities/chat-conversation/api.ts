import 'server-only';
import type { AgentImageMediaType } from '@y0ngha/siglens-core';
import {
    and,
    desc,
    eq,
    getTableColumns,
    gt,
    gte,
    like,
    lt,
    max,
    not,
    or,
    sql,
    type SQL,
} from 'drizzle-orm';
import {
    WEB_SEARCH_BODIES_OMITTED_KEY,
    WEB_SEARCH_RETENTION_DAYS,
} from '@/shared/api/web/webSearchResult';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    chatConversations,
    chatMessageImages,
    chatMessages,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import {
    CONVERSATION_LIST_LIMIT,
    CONVERSATION_TITLE_COLUMN_MAX,
    deriveTitle,
    type ChatConversationRecord,
    type ChatImageRef,
    type ChatMessageRecord,
    type NewChatMessage,
} from './model';
import type { NormalizedChatImage } from './server/normalizeChatImage';

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
 * 저장된 이미지 한 장 — 재생성·수정 때 새 user 행에 다시 저장하려고 바이트까지 읽은 모양.
 * 지금 쓰기 경로는 항상 WebP지만 열은 형식을 담는다 — 읽을 때 그 값을 그대로 돌려줘야 모델에 보내는
 * `mediaType`이 바이트와 어긋나지 않는다. `NormalizedChatImage`는 이 타입에 그대로 들어간다.
 */
export interface StoredChatImage extends Omit<
    NormalizedChatImage,
    'mediaType'
> {
    mediaType: AgentImageMediaType;
}

const AGENT_IMAGE_MEDIA_TYPES: readonly AgentImageMediaType[] = [
    'image/webp',
    'image/jpeg',
    'image/png',
];

function toAgentImageMediaType(value: string): AgentImageMediaType {
    const found = AGENT_IMAGE_MEDIA_TYPES.find(type => type === value);
    // 쓰기는 정규화 결과만 넣으므로 모르는 값은 손상된 행이다 — 엉뚱한 형식 표시로 모델에 보내지 말고 던진다.
    if (found === undefined)
        throw new Error(`unsupported stored image media type: ${value}`);
    return found;
}

/** 이미지 조회 라우트용 — 바이트와 그 이미지가 속한 대화의 소유자. */
export interface ChatImageWithOwner {
    mediaType: string;
    data: Buffer;
    ownerId: string;
}

/**
 * SIGLENS AI 대화·메시지의 Drizzle 저장소.
 *
 * 대화 메서드(`create`/`findForUser`/`listForUser`/`countForUser`/`rename`/`delete`)는
 * 소유자 범위다: 조회 후 검사가 아니라 SQL `WHERE`에서 `userId`로 걸러, 훗날 리팩터링에도
 * 다른 사용자의 행이 새지 않는다.
 *
 * **메시지 메서드(`listMessages`, `appendMessages`, `setTurnAt`, `supersedeAfterLastUser`,
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
        /** 첫 메시지에 이미지가 붙었는지 — 글이 비면 "이미지 분석" 제목을 쓴다. */
        hasImages?: boolean;
        locale: Locale;
        modelId: string;
    }): Promise<ChatConversationRecord> {
        const [row] = await this.db
            .insert(chatConversations)
            .values({
                userId: input.userId,
                title: deriveTitle(
                    input.firstMessage,
                    input.locale,
                    input.hasImages
                ),
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

    /**
     * 소유자 범위가 아니다(클래스 문서 참고). 형식이 틀린 `conversationId`는 쿼리 없이 `[]`. 일시 DB 오류는 재시도한다.
     *
     * `withCharts`가 아니면 tool 행의 차트 블록(`chart`, 행마다 봉 120~400개)을 읽지 않는다 — 매 턴의 이력 읽기
     * (`prepareTurn`)는 모델 기록만 만들고 차트를 쓰지 않는다. 대화 화면(`getConversationAction`)만 켠다.
     */
    async listMessages(
        conversationId: string,
        { withCharts = false }: { withCharts?: boolean } = {}
    ): Promise<ChatMessageRecord[]> {
        if (!isValidUuid(conversationId)) return [];
        const { chart, ...withoutChart } = getTableColumns(chatMessages);
        const rows = await withRetry(
            () =>
                this.db
                    .select(
                        withCharts ? { ...withoutChart, chart } : withoutChart
                    )
                    .from(chatMessages)
                    .where(eq(chatMessages.conversationId, conversationId))
                    .orderBy(chatMessages.seq),
            DB_TRANSIENT_RETRY
        );
        const imagesByMessage = rows.some(r => r.role === 'user')
            ? await this.listImageRefs(conversationId)
            : new Map<string, ChatImageRef[]>();
        // 선택 컬럼이 `withCharts`에 따라 둘 중 하나라 drizzle이 행 타입을 하나로 좁히지 못한다. 두 경우 모두 테이블의
        // 컬럼 그대로이고, 차트 컬럼을 빼고 읽은 행은 `chart: null`로 채우므로(읽었으면 `...row`가 덮는다) 레코드 모양과 같다.
        return rows.map(row => ({
            chart: null,
            ...row,
            images: imagesByMessage.get(row.id) ?? [],
        })) as ChatMessageRecord[];
    }

    /**
     * 대화의 모든 이미지 참조(바이트 제외)를 메시지 id별로 묶는다. `data`(bytea)를 읽지 않아 매 턴의
     * 기록 읽기가 이미지 크기에 비례해 커지지 않는다.
     */
    private async listImageRefs(
        conversationId: string
    ): Promise<Map<string, ChatImageRef[]>> {
        const refs = await withRetry(
            () =>
                this.db
                    .select({
                        messageId: chatMessageImages.messageId,
                        id: chatMessageImages.id,
                        width: chatMessageImages.width,
                        height: chatMessageImages.height,
                    })
                    .from(chatMessageImages)
                    .innerJoin(
                        chatMessages,
                        eq(chatMessageImages.messageId, chatMessages.id)
                    )
                    .where(eq(chatMessages.conversationId, conversationId))
                    .orderBy(chatMessageImages.position),
            DB_TRANSIENT_RETRY
        );
        // 한 번에 묶는다 — 요소마다 배열을 복사하는 reduce는 한 메시지에 이미지가 몰릴수록 O(n²)다.
        // `position` 순 정렬은 SQL이 끝냈고 `groupBy`는 입력 순서를 지킨다.
        const byMessage = Map.groupBy(refs, ref => ref.messageId);
        return new Map(
            Array.from(byMessage, ([messageId, group]) => [
                messageId,
                group.map(({ id, width, height }) => ({ id, width, height })),
            ])
        );
    }

    /**
     * 소유자 범위가 아니다(클래스 문서 참고). 한 user 행의 이미지를 바이트까지 `position` 순으로 읽는다 —
     * edit이 행을 지우기 전에 읽어 새 행에 다시 저장하고, regenerate가 모델에 다시 보낼 때 쓴다.
     * 형식이 틀린 `messageId`는 쿼리 없이 `[]`.
     */
    async listImagesOfMessage(messageId: string): Promise<StoredChatImage[]> {
        if (!isValidUuid(messageId)) return [];
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        mediaType: chatMessageImages.mediaType,
                        data: chatMessageImages.data,
                        width: chatMessageImages.width,
                        height: chatMessageImages.height,
                    })
                    .from(chatMessageImages)
                    .where(eq(chatMessageImages.messageId, messageId))
                    .orderBy(chatMessageImages.position),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            mediaType: toAgentImageMediaType(row.mediaType),
            bytes: row.data,
            width: row.width,
            height: row.height,
        }));
    }

    /**
     * 이미지 한 장과 그 소유 대화의 `userId`. 조회 라우트가 세션 사용자와 대조해 소유자에게만 돌려준다 —
     * 없는 id·형식이 틀린 id는 `null`이라 "없음"과 "내 것이 아님"이 같은 모양이다.
     */
    async findImageWithOwner(id: string): Promise<ChatImageWithOwner | null> {
        if (!isValidUuid(id)) return null;
        const [row] = await withRetry(
            () =>
                this.db
                    .select({
                        mediaType: chatMessageImages.mediaType,
                        data: chatMessageImages.data,
                        ownerId: chatConversations.userId,
                    })
                    .from(chatMessageImages)
                    .innerJoin(
                        chatMessages,
                        eq(chatMessageImages.messageId, chatMessages.id)
                    )
                    .innerJoin(
                        chatConversations,
                        eq(chatMessages.conversationId, chatConversations.id)
                    )
                    .where(eq(chatMessageImages.id, id))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return row ?? null;
    }

    /**
     * user 메시지 한 건과 그 이미지를 한 트랜잭션으로 넣는다 — 이미지 저장이 실패하면 user 행도 남지 않는다
     * (이미지만 빠진 기록은 대화를 다시 열었을 때 맥락이 깨진다). 이미지가 없으면 `appendMessages`와 같다.
     * 소유자 범위가 아니다(클래스 문서 참고). 재시도하지 않는다.
     */
    async appendUserMessage(
        conversationId: string,
        content: string,
        images: readonly StoredChatImage[]
    ): Promise<ChatMessageRecord | undefined> {
        if (images.length === 0)
            return (
                await this.appendMessages(conversationId, [
                    { role: 'user', content },
                ])
            )[0];
        if (!isValidUuid(conversationId)) return undefined;
        const inserted = await this.db.transaction(async tx => {
            const [message] = await tx
                .insert(chatMessages)
                .values({
                    conversationId,
                    seq: sql<number>`(select coalesce(max(${chatMessages.seq}), 0) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId}) + 1`,
                    role: 'user',
                    content,
                    status: 'complete',
                })
                .returning();
            if (!message)
                throw new Error('chat message insert returned no row');
            await tx.insert(chatMessageImages).values(
                images.map((image, position) => ({
                    messageId: message.id,
                    position,
                    mediaType: image.mediaType,
                    width: image.width,
                    height: image.height,
                    byteSize: image.bytes.byteLength,
                    data: image.bytes,
                }))
            );
            return message;
        });
        await this.refreshCounters(conversationId);
        return inserted as ChatMessageRecord;
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
            chart: m.chart ?? null,
            status: m.status ?? 'complete',
        }));
        const inserted = await this.db
            .insert(chatMessages)
            .values(rows)
            .returning();
        await this.refreshCounters(conversationId);
        return inserted as ChatMessageRecord[];
    }

    /**
     * user 행에 그 턴의 시계 메모를 만든 UTC 시각을 저장한다(멱등 UPDATE 한 번 — `regenerate`는 같은 행을 덮어쓴다).
     * `turnAt`은 core가 돌려준 ISO 문자열이며 `Date`로 바꿔도 밀리초까지 그대로다. `conversationId`를 WHERE에 함께 걸어,
     * 호출자가 쥔 (대화, 행) 쌍이 어긋나면 아무 행도 바꾸지 않는다. 소유자 범위가 아니다(클래스 문서 참고).
     * 형식이 틀린 id나 시각은 쿼리 없이 no-op. 시각이 없으면 다음 턴 캐시가 한 번 빗나갈 뿐이라, 실패를 어떻게
     * 다룰지는 호출자가 정한다.
     */
    async setTurnAt(
        conversationId: string,
        messageId: string,
        turnAt: string
    ): Promise<void> {
        if (!isValidUuid(conversationId) || !isValidUuid(messageId)) return;
        const at = new Date(turnAt);
        if (Number.isNaN(at.getTime())) return;
        await withRetry(
            () =>
                this.db
                    .update(chatMessages)
                    .set({ turnAt: at })
                    .where(
                        and(
                            eq(chatMessages.id, messageId),
                            eq(chatMessages.conversationId, conversationId)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 메시지는 이미 커밋됐다. 카운터 갱신이 재시도 후에도 실패했을 때 턴을 실패로 알리면
     * 호출자가 재시도해 방금 넣은 행이 중복되므로, 오류를 삼킨다.
     * 다음 호출이 `message_count`/`last_message_at`을 처음부터 다시 계산해 복구한다.
     */
    private async refreshCounters(conversationId: string): Promise<void> {
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

    /**
     * 보존 기간 작업용(소유자 범위가 아니다 — 시스템 작업이라 사용자와 무관하게 읽는다). 생성 시각이 DB 시계 기준
     * 보존 일수(`WEB_SEARCH_RETENTION_DAYS`)보다 이른(`now() - make_interval`, DB-7) `web_search` 도구 행 중 **아직 줄이지 않은** 행을 `id` 순서로 `afterId` 다음부터 `limit`개 돌려준다.
     * "줄이지 않았다"는 표식(`"bodiesOmitted":true`)이 없는 결과 모양(`"results":[` 또는 잘림 봉투의 `"preview":`)이다 —
     * 오류 결과는 어느 쪽에도 맞지 않아 매일 다시 읽히지 않는다. 직렬화에 공백이 없어 부분 문자열로 찾는다. `id` 키셋
     * 페이지네이션이라 줄일 수 없었던 행이 있어도 한 번의 실행 안에서는 다시 읽지 않는다.
     */
    async listUnstrippedWebSearchRows(
        afterId: string | null,
        limit: number
    ): Promise<Array<{ id: string; content: string }>> {
        return withRetry(
            () =>
                this.db
                    .select({
                        id: chatMessages.id,
                        content: chatMessages.content,
                    })
                    .from(chatMessages)
                    .where(
                        and(
                            eq(chatMessages.toolName, 'web_search'),
                            lt(
                                chatMessages.createdAt,
                                sql`now() - make_interval(days => ${WEB_SEARCH_RETENTION_DAYS})`
                            ),
                            not(
                                like(
                                    chatMessages.content,
                                    `%"${WEB_SEARCH_BODIES_OMITTED_KEY}":true%`
                                )
                            ),
                            or(
                                like(chatMessages.content, '%"results":[%'),
                                like(chatMessages.content, '%"preview":%')
                            ),
                            afterId === null
                                ? undefined
                                : gt(chatMessages.id, afterId)
                        )
                    )
                    .orderBy(chatMessages.id)
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 보존 기간 작업용. 줄인 `content`를 한 트랜잭션에서 쓴다. 이미 줄인 행(표식이 있는 행)은 `WHERE`가 거르므로 같은
     * 입력으로 다시 불러도 아무것도 바뀌지 않는다(멱등). 실제로 바뀐 행 수를 돌려준다.
     */
    async rewriteWebSearchContent(
        updates: ReadonlyArray<{ id: string; content: string }>
    ): Promise<number> {
        if (updates.length === 0) return 0;
        // 트랜잭션은 연결 하나라 UPDATE가 어차피 한 줄로 선다. `Promise.all`로 동시에 띄운 것처럼 보이지 않게
        // 하나가 끝난 뒤 다음을 보내는 사슬로 쓴다.
        return this.db.transaction(async tx =>
            updates.reduce<Promise<number>>(
                (previous, update) =>
                    previous.then(async sum => {
                        const rows = await tx
                            .update(chatMessages)
                            .set({ content: update.content })
                            .where(
                                and(
                                    eq(chatMessages.id, update.id),
                                    eq(chatMessages.toolName, 'web_search'),
                                    not(
                                        like(
                                            chatMessages.content,
                                            `%"${WEB_SEARCH_BODIES_OMITTED_KEY}":true%`
                                        )
                                    )
                                )
                            )
                            .returning({ id: chatMessages.id });
                        return sum + rows.length;
                    }),
                Promise.resolve(0)
            )
        );
    }
}
