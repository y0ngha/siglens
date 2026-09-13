import { inspect } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockUser, repo, RepoCtor } = vi.hoisted(() => {
    const repo = {
        listForUser: vi.fn(),
        findForUser: vi.fn(),
        listMessages: vi.fn(),
        rename: vi.fn(),
        delete: vi.fn(),
    };
    const RepoCtor = vi.fn(function () {
        return repo;
    });
    return { mockUser: vi.fn(), repo, RepoCtor };
});
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: mockUser,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: RepoCtor,
}));
import {
    deleteConversationAction,
    getConversationAction,
    listConversationsAction,
    renameConversationAction,
} from '@/entities/chat-conversation/actions';

const VALID_ID = '11111111-1111-1111-1111-111111111111';
const VALID_USER = '22222222-2222-2222-2222-222222222222';

describe('chat-conversation actions', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('unauthenticated', () => {
        it('비로그인은 실패/빈 결과이고 repository를 생성하지 않는다', async () => {
            mockUser.mockResolvedValue(null);
            expect(await listConversationsAction()).toEqual([]);
            expect(await getConversationAction(VALID_ID)).toBeNull();
            expect(await deleteConversationAction(VALID_ID)).toEqual({
                ok: false,
            });
            expect(await renameConversationAction(VALID_ID, 'title')).toEqual({
                ok: false,
            });
            expect(RepoCtor).not.toHaveBeenCalled();
        });
    });

    describe('listConversationsAction', () => {
        it('행을 ISO 타임스탬프로 매핑하고 user.id로 조회한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            const lastMessageAt = new Date('2026-01-01T00:00:00.000Z');
            repo.listForUser.mockResolvedValue([
                { id: VALID_ID, title: 't', lastMessageAt },
            ]);
            expect(await listConversationsAction()).toEqual([
                {
                    id: VALID_ID,
                    title: 't',
                    lastMessageAt: lastMessageAt.toISOString(),
                },
            ]);
            expect(repo.listForUser).toHaveBeenCalledWith(VALID_USER);
        });

        it('repository가 던지면 빈 배열로 낙폭 처리', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.listForUser.mockRejectedValue(new Error('db down'));
            expect(await listConversationsAction()).toEqual([]);
        });
    });

    describe('getConversationAction', () => {
        it('findForUser가 null이면 null을 반환하고 listMessages는 호출하지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.findForUser.mockResolvedValue(null);
            expect(await getConversationAction(VALID_ID)).toBeNull();
            expect(repo.listMessages).not.toHaveBeenCalled();
        });

        it('superseded 행을 거르고 소유자로 조회한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.findForUser.mockResolvedValue({ id: VALID_ID, title: 't' });
            repo.listMessages.mockResolvedValue([
                {
                    id: 'm1',
                    seq: 1,
                    role: 'user',
                    content: 'q',
                    toolCalls: null,
                    toolName: null,
                    status: 'complete',
                    createdAt: new Date(),
                },
                {
                    id: 'm2',
                    seq: 2,
                    role: 'assistant',
                    content: 'old',
                    toolCalls: null,
                    toolName: null,
                    status: 'superseded',
                    createdAt: new Date(),
                },
            ]);
            expect(
                (await getConversationAction(VALID_ID))?.messages.map(m => m.id)
            ).toEqual(['m1']);
            expect(repo.findForUser).toHaveBeenCalledWith(VALID_ID, VALID_USER);
        });

        it('id가 문자열이 아니면 null이고 repository를 생성하지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(
                await getConversationAction(123 as unknown as string)
            ).toBeNull();
            expect(RepoCtor).not.toHaveBeenCalled();
        });

        it('repository가 던지면 null로 낙폭 처리', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.findForUser.mockRejectedValue(new Error('db down'));
            expect(await getConversationAction(VALID_ID)).toBeNull();
        });
    });

    describe('renameConversationAction', () => {
        it('121자는 거부하고 repo.rename을 호출하지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(
                await renameConversationAction(VALID_ID, 'x'.repeat(121))
            ).toEqual({ ok: false });
            expect(repo.rename).not.toHaveBeenCalled();
        });

        it('정확히 120자는 허용한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            const title = 'x'.repeat(120);
            expect(await renameConversationAction(VALID_ID, title)).toEqual({
                ok: true,
            });
            expect(repo.rename).toHaveBeenCalledWith(
                VALID_ID,
                VALID_USER,
                title
            );
        });

        it('공백만 있으면 거부한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(await renameConversationAction(VALID_ID, '   ')).toEqual({
                ok: false,
            });
            expect(repo.rename).not.toHaveBeenCalled();
        });

        it('trim 후 저장한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(await renameConversationAction(VALID_ID, ' 제목 ')).toEqual({
                ok: true,
            });
            expect(repo.rename).toHaveBeenCalledWith(
                VALID_ID,
                VALID_USER,
                '제목'
            );
        });

        it('title이 문자열이 아니면 거부하고 repository를 생성하지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(
                await renameConversationAction(
                    VALID_ID,
                    42 as unknown as string
                )
            ).toEqual({ ok: false });
            expect(RepoCtor).not.toHaveBeenCalled();
        });

        it('repository가 던지면 실패 결과로 낙폭 처리', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.rename.mockRejectedValue(new Error('db down'));
            expect(await renameConversationAction(VALID_ID, '제목')).toEqual({
                ok: false,
            });
        });

        it('실패 로그에 사용자가 입력한 제목 텍스트가 포함되지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            const sensitiveTitle = '민감한-제목-절대-로그-금지';
            // DrizzleQueryError-shaped: real driver errors embed bound query
            // params (here, the title) in `.message`.
            repo.rename.mockRejectedValue(
                new Error(
                    `Failed query: update ... set title = '${sensitiveTitle}' ...`
                )
            );
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                expect(
                    await renameConversationAction(VALID_ID, sensitiveTitle)
                ).toEqual({ ok: false });
                expect(errorSpy).toHaveBeenCalled();
                const loggedArgs = errorSpy.mock.calls
                    .flat()
                    // inspect, not JSON.stringify: an Error's message/stack are non-enumerable
                    // and would serialize to "{}", hiding a leak.
                    .map(arg => inspect(arg, { depth: 5 }))
                    .join(' ');
                expect(loggedArgs).not.toContain(sensitiveTitle);
            } finally {
                errorSpy.mockRestore();
            }
        });
    });

    describe('deleteConversationAction', () => {
        it('인증된 사용자는 delete(id, userId)를 호출한다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(await deleteConversationAction(VALID_ID)).toEqual({
                ok: true,
            });
            expect(repo.delete).toHaveBeenCalledWith(VALID_ID, VALID_USER);
        });

        it('id가 문자열이 아니면 거부하고 repository를 생성하지 않는다', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            expect(
                await deleteConversationAction(999 as unknown as string)
            ).toEqual({ ok: false });
            expect(RepoCtor).not.toHaveBeenCalled();
        });

        it('repository가 던지면 실패 결과로 낙폭 처리', async () => {
            mockUser.mockResolvedValue({ id: VALID_USER });
            repo.delete.mockRejectedValue(new Error('db down'));
            expect(await deleteConversationAction(VALID_ID)).toEqual({
                ok: false,
            });
        });
    });
});
