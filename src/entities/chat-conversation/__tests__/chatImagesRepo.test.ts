import { createSqlCaptureDb } from '@/__tests__/utils/drizzleSqlCapture';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import {
    deriveTitle,
    toAgentHistory,
    toMessageView,
    type ChatMessageRecord,
} from '@/entities/chat-conversation/model';
import type { SiglensDatabase } from '@/shared/db/types';

const CONV = '11111111-1111-1111-1111-111111111111';
const MSG_A = '33333333-3333-3333-3333-333333333333';
const MSG_B = '44444444-4444-4444-4444-444444444444';
const IMG_1 = '55555555-5555-5555-5555-555555555551';
const IMG_2 = '55555555-5555-5555-5555-555555555552';

const image = (n: number) => ({
    mediaType: 'image/webp' as const,
    bytes: Buffer.alloc(n, 1),
    width: 10 * n,
    height: 5 * n,
});

describe('listMessages — 이미지 참조', () => {
    const userRow = (id: string) => ({
        id,
        conversationId: CONV,
        seq: 1,
        role: 'user',
        content: 'q',
    });

    it('user 행에 이미지 참조(id·크기)를 position 순으로 붙이고 바이트는 읽지 않는다', async () => {
        const { db, captured } = createSqlCaptureDb(query =>
            query.sql.includes('"chat_message_images"')
                ? [
                      { messageId: MSG_A, id: IMG_1, width: 10, height: 5 },
                      { messageId: MSG_A, id: IMG_2, width: 20, height: 10 },
                  ]
                : [userRow(MSG_A), userRow(MSG_B)]
        );
        const rows = await new DrizzleChatConversationRepository(
            db
        ).listMessages(CONV);
        expect(rows.find(r => r.id === MSG_A)?.images).toEqual([
            { id: IMG_1, width: 10, height: 5 },
            { id: IMG_2, width: 20, height: 10 },
        ]);
        expect(rows.find(r => r.id === MSG_B)?.images).toEqual([]);
        const imageQuery = captured.find(q =>
            q.sql.includes('from "chat_message_images"')
        );
        expect(imageQuery).toBeDefined();
        expect(imageQuery?.sql).toBe(
            'select "chat_message_images"."message_id", "chat_message_images"."id", "chat_message_images"."width", "chat_message_images"."height" from "chat_message_images" inner join "chat_messages" on "chat_message_images"."message_id" = "chat_messages"."id" where "chat_messages"."conversation_id" = $1 order by "chat_message_images"."position"'
        );
        expect(imageQuery?.params).toContain(CONV);
    });

    it('user 행이 없으면 이미지 쿼리를 보내지 않는다', async () => {
        const { db, captured } = createSqlCaptureDb([
            { ...userRow(MSG_A), role: 'assistant' },
        ]);
        await new DrizzleChatConversationRepository(db).listMessages(CONV);
        expect(captured).toHaveLength(1);
    });
});

describe('appendUserMessage', () => {
    interface TxStub {
        insert: ReturnType<typeof vi.fn>;
    }
    function stubDb(failImages = false) {
        const recordInsert = vi.fn((_table: unknown, _values: unknown) => {});
        const tx: TxStub = {
            insert: vi.fn((table: unknown) => ({
                values: (values: unknown) => {
                    recordInsert(table, values);
                    const isMessage =
                        !Array.isArray(values) &&
                        (values as { role?: string }).role === 'user';
                    if (isMessage)
                        return {
                            returning: () =>
                                Promise.resolve([{ id: MSG_A, seq: 3 }]),
                        };
                    return failImages
                        ? Promise.reject(new Error('image insert failed'))
                        : Promise.resolve([]);
                },
            })),
        };
        const update = vi.fn(() => ({
            set: () => ({ where: () => Promise.resolve([]) }),
        }));
        const db = {
            transaction: vi.fn(async (cb: (t: TxStub) => Promise<unknown>) =>
                cb(tx)
            ),
            update,
        } as unknown as SiglensDatabase;
        const inserted = {
            valuesAt: (i: number): unknown => recordInsert.mock.calls[i]?.[1],
        };
        return { db, inserted, update };
    }

    it('user 행과 이미지 행을 한 트랜잭션에 넣고 position·byte_size를 채운다', async () => {
        const { db, inserted, update } = stubDb();
        const saved = await new DrizzleChatConversationRepository(
            db
        ).appendUserMessage(CONV, '이거 어때?', [image(2), image(3)]);
        expect(saved?.id).toBe(MSG_A);
        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(inserted.valuesAt(0)).toMatchObject({
            conversationId: CONV,
            role: 'user',
            content: '이거 어때?',
        });
        expect(inserted.valuesAt(1)).toEqual([
            expect.objectContaining({
                messageId: MSG_A,
                position: 0,
                mediaType: 'image/webp',
                width: 20,
                height: 10,
                byteSize: 2,
            }),
            expect.objectContaining({
                messageId: MSG_A,
                position: 1,
                byteSize: 3,
            }),
        ]);
        // 카운터 재계산은 트랜잭션 밖에서 한 번.
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('이미지 저장이 실패하면 던지고 카운터도 갱신하지 않는다(user 행만 남지 않는다)', async () => {
        const { db, update } = stubDb(true);
        await expect(
            new DrizzleChatConversationRepository(db).appendUserMessage(
                CONV,
                'q',
                [image(1)]
            )
        ).rejects.toThrow('image insert failed');
        expect(update).not.toHaveBeenCalled();
    });

    it('이미지가 없으면 트랜잭션 없이 appendMessages와 같은 경로다', async () => {
        const { db, captured } = createSqlCaptureDb([{ id: MSG_A, seq: 1 }]);
        const saved = await new DrizzleChatConversationRepository(
            db
        ).appendUserMessage(CONV, 'q', []);
        expect(saved?.id).toBe(MSG_A);
        expect(captured[0]?.sql.toLowerCase()).toBe(
            'insert into "chat_messages" ("id", "conversation_id", "seq", "role", "content", "tool_calls", "tool_call_id", "tool_name", "model_id", "usage", "turn_at", "chart", "status", "created_at") values (default, $1, (select coalesce(max("chat_messages"."seq"), 0) from "chat_messages" where "chat_messages"."conversation_id" = $2) + $3, $4, $5, $6, $7, $8, $9, $10, default, $11, $12, default) returning "id", "conversation_id", "seq", "role", "content", "tool_calls", "tool_call_id", "tool_name", "model_id", "usage", "turn_at", "chart", "status", "created_at"'
        );
    });

    it('UUID가 아니면 이미지가 있어도 쿼리 없이 undefined', async () => {
        const { db } = stubDb();
        expect(
            await new DrizzleChatConversationRepository(db).appendUserMessage(
                'nope',
                'q',
                [image(1)]
            )
        ).toBeUndefined();
        expect(db.transaction).not.toHaveBeenCalled();
    });
});

describe('이미지 조회', () => {
    it('findImageWithOwner: 이미지 id로 대화 소유자까지 조인해 읽는다', async () => {
        const row = {
            mediaType: 'image/webp',
            data: Buffer.alloc(2),
            ownerId: 'u1',
        };
        const { db, captured } = createSqlCaptureDb([row]);
        const found = await new DrizzleChatConversationRepository(
            db
        ).findImageWithOwner(IMG_1);
        expect(found).toEqual(row);
        const sqlText = captured[0]?.sql.toLowerCase() ?? '';
        expect(sqlText).toBe(
            'select "chat_message_images"."media_type", "chat_message_images"."data", "chat_conversations"."user_id" from "chat_message_images" inner join "chat_messages" on "chat_message_images"."message_id" = "chat_messages"."id" inner join "chat_conversations" on "chat_messages"."conversation_id" = "chat_conversations"."id" where "chat_message_images"."id" = $1 limit $2'
        );
        expect(captured[0]?.params).toContain(IMG_1);
    });

    it('findImageWithOwner: 없거나 UUID가 아니면 null(UUID는 쿼리 없이)', async () => {
        const { db, captured } = createSqlCaptureDb([]);
        const repo = new DrizzleChatConversationRepository(db);
        expect(await repo.findImageWithOwner(IMG_1)).toBeNull();
        expect(await repo.findImageWithOwner('nope')).toBeNull();
        expect(captured).toHaveLength(1);
    });

    it('listImagesOfMessage: 바이트를 position 순으로 읽고 UUID가 아니면 []', async () => {
        const { db, captured } = createSqlCaptureDb([
            {
                mediaType: 'image/webp',
                data: Buffer.alloc(3),
                width: 7,
                height: 4,
            },
        ]);
        const repo = new DrizzleChatConversationRepository(db);
        expect(await repo.listImagesOfMessage(MSG_A)).toEqual([
            {
                mediaType: 'image/webp',
                bytes: Buffer.alloc(3),
                width: 7,
                height: 4,
            },
        ]);
        expect(captured[0]?.sql).toBe(
            'select "media_type", "data", "width", "height" from "chat_message_images" where "chat_message_images"."message_id" = $1 order by "chat_message_images"."position"'
        );
        expect(captured[0]?.params).toContain(MSG_A);
        expect(await repo.listImagesOfMessage('nope')).toEqual([]);
        expect(captured).toHaveLength(1);
    });

    it('listImagesOfMessage: 저장된 media_type을 그대로 돌려준다(WebP로 고정하지 않는다)', async () => {
        const { db } = createSqlCaptureDb([
            {
                mediaType: 'image/png',
                data: Buffer.alloc(1),
                width: 1,
                height: 1,
            },
        ]);
        const repo = new DrizzleChatConversationRepository(db);
        expect(await repo.listImagesOfMessage(MSG_A)).toMatchObject([
            { mediaType: 'image/png' },
        ]);
    });

    it('listImagesOfMessage: 모르는 media_type은 던진다', async () => {
        const { db } = createSqlCaptureDb([
            {
                mediaType: 'image/bmp',
                data: Buffer.alloc(1),
                width: 1,
                height: 1,
            },
        ]);
        const repo = new DrizzleChatConversationRepository(db);
        await expect(repo.listImagesOfMessage(MSG_A)).rejects.toThrow(
            /image\/bmp/
        );
    });
});

describe('모델 — 이미지', () => {
    const base = {
        toolCalls: null,
        toolCallId: null,
        toolName: null,
        status: 'complete',
    } as const;

    it('toAgentHistory: 이미지가 있던 user 행에만 첨부 표식 줄을 붙인다', () => {
        const history = toAgentHistory([
            {
                ...base,
                role: 'user',
                content: '이거 어때?',
                images: [{ id: 'i', width: 1, height: 1 }],
            },
            { ...base, role: 'assistant', content: '답' },
            { ...base, role: 'user', content: '그냥 질문', images: [] },
            {
                ...base,
                role: 'user',
                content: '',
                images: [
                    { id: 'a', width: 1, height: 1 },
                    { id: 'b', width: 1, height: 1 },
                ],
            },
        ]);
        expect(history.map(m => m.content)).toEqual([
            '이거 어때?\n[attached images: 1]',
            '답',
            '그냥 질문',
            '[attached images: 2]',
        ]);
    });

    it('toMessageView: user 행의 이미지만 싣고, 없으면 키 자체를 싣지 않는다', () => {
        const rec = (over: Partial<ChatMessageRecord>): ChatMessageRecord => ({
            id: 'm',
            conversationId: CONV,
            seq: 1,
            role: 'user',
            content: 'q',
            toolCalls: null,
            toolCallId: null,
            toolName: null,
            modelId: null,
            usage: null,
            chart: null,
            status: 'complete',
            createdAt: new Date('2026-11-19T00:00:00Z'),
            ...over,
        });
        const refs = [{ id: IMG_1, width: 10, height: 5 }];
        expect(toMessageView(rec({ images: refs })).images).toEqual(refs);
        expect(toMessageView(rec({ images: [] }))).not.toHaveProperty('images');
        expect(toMessageView(rec({}))).not.toHaveProperty('images');
        expect(
            toMessageView(rec({ role: 'assistant', images: refs }))
        ).not.toHaveProperty('images');
    });

    it('deriveTitle: 글이 비고 이미지가 있으면 로케일별 이미지 분석 제목', () => {
        expect(deriveTitle('', 'ko', true)).toBe('이미지 분석');
        expect(deriveTitle('  ', 'en', true)).toBe('Image analysis');
        expect(deriveTitle('', 'ko', false)).toBe('새 대화');
        expect(deriveTitle('NVDA 어때?', 'ko', true)).toBe('NVDA 어때?');
    });
});
