const { mockUser, repo, RepoCtor, load } = vi.hoisted(() => {
    const repo = {
        findForUser: vi.fn(),
        listMessages: vi.fn(),
        // 쓰기 메서드는 하나도 불리면 안 된다 — 호출되면 아래 테스트가 잡는다.
        create: vi.fn(),
        appendMessages: vi.fn(),
        rename: vi.fn(),
        delete: vi.fn(),
        supersedeAfterLastUser: vi.fn(),
        deleteFromSeq: vi.fn(),
    };
    return {
        mockUser: vi.fn(),
        repo,
        RepoCtor: vi.fn(function () {
            return repo;
        }),
        load: vi.fn(),
    };
});
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: mockUser,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: RepoCtor,
}));
vi.mock('@/entities/chat-conversation/server/loadConversationChanges', () => ({
    loadConversationChanges: load,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getConversationChangesAction } from '@/entities/chat-conversation/actions/getConversationChangesAction';

const ID = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

const changes = {
    symbol: 'NVDA',
    marketProfile: 'us-equity',
    analyzedAt: '2026-11-18T14:00:00.000Z',
    analyzedDate: '2026-11-18',
    status: 'changes',
};

describe('getConversationChangesAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockUser.mockResolvedValue({ id: USER });
        repo.findForUser.mockResolvedValue({ id: ID });
        repo.listMessages.mockResolvedValue([]);
        load.mockResolvedValue([changes]);
    });

    it('비로그인은 빈 배열이고 저장소를 만들지 않는다', async () => {
        mockUser.mockResolvedValue(null);
        expect(await getConversationChangesAction(ID)).toEqual([]);
        expect(RepoCtor).not.toHaveBeenCalled();
    });

    it('남의 대화·없는 대화는 빈 배열이고 메시지를 읽지 않는다', async () => {
        repo.findForUser.mockResolvedValue(null);
        expect(await getConversationChangesAction(ID)).toEqual([]);
        expect(repo.findForUser).toHaveBeenCalledWith(ID, USER);
        expect(repo.listMessages).not.toHaveBeenCalled();
        expect(load).not.toHaveBeenCalled();
    });

    it('문자열이 아닌 인자는 DB에 가기 전에 거른다', async () => {
        expect(
            await getConversationChangesAction({ id: ID } as unknown as string)
        ).toEqual([]);
        expect(RepoCtor).not.toHaveBeenCalled();
    });

    it('superseded 행을 빼고 계산해 돌려준다', async () => {
        repo.listMessages.mockResolvedValue([
            { seq: 1, status: 'complete' },
            { seq: 2, status: 'superseded' },
        ]);
        expect(await getConversationChangesAction(ID)).toEqual([changes]);
        expect(load).toHaveBeenCalledWith([{ seq: 1, status: 'complete' }]);
    });

    it('비교할 게 없는 종목(same_session)은 페이로드에서 뺀다', async () => {
        load.mockResolvedValue([
            { ...changes, symbol: 'AAPL', status: 'same_session' },
            { ...changes, symbol: 'MSFT', status: 'too_old' },
            changes,
        ]);
        const results = await getConversationChangesAction(ID);
        expect(results.map(r => r.symbol)).toEqual(['MSFT', 'NVDA']);
    });

    it('저장소·계산이 던져도 던지지 않고 빈 배열이다', async () => {
        load.mockRejectedValue(new Error('boom'));
        expect(await getConversationChangesAction(ID)).toEqual([]);
        repo.findForUser.mockRejectedValue(new Error('db down'));
        expect(await getConversationChangesAction(ID)).toEqual([]);
        mockUser.mockRejectedValue(new Error('session down'));
        expect(await getConversationChangesAction(ID)).toEqual([]);
    });

    it('아무것도 쓰지 않는다(읽기 전용)', async () => {
        await getConversationChangesAction(ID);
        for (const method of [
            repo.create,
            repo.appendMessages,
            repo.rename,
            repo.delete,
            repo.supersedeAfterLastUser,
            repo.deleteFromSeq,
        ])
            expect(method).not.toHaveBeenCalled();
    });
});
