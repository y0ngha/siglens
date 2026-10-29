import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repo, portfolio, RepoCtor, PortfolioCtor } = vi.hoisted(() => {
    const repo = {
        create: vi.fn(),
        findForUser: vi.fn(),
        listMessages: vi.fn(),
        appendMessages: vi.fn(),
        countForUser: vi.fn(),
        supersedeAfterLastUser: vi.fn(),
        deleteFromSeq: vi.fn(),
    };
    const portfolio = { findByUser: vi.fn() };
    return {
        repo,
        portfolio,
        RepoCtor: vi.fn(function (this: unknown) {
            return repo;
        }),
        PortfolioCtor: vi.fn(function (this: unknown) {
            return portfolio;
        }),
    };
});

vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: RepoCtor,
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: PortfolioCtor,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import {
    guestTurn,
    isConversationGone,
    prepareMemberTurn,
} from '@/app/api/ai/chat/stream/_lib/prepareTurn';
import type { ParsedBody } from '@/app/api/ai/chat/stream/_lib/parseBody';

const ROW = (seq: number, role: 'user' | 'assistant', content: string) => ({
    id: `m${seq}`,
    seq,
    role,
    content,
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    status: 'complete' as const,
});

const sendBody = (conversationId: string | null = 'c1'): ParsedBody => ({
    conversationId,
    message: 'hello',
    action: 'send',
    history: [],
});

describe('guestTurn', () => {
    it('브라우저가 보낸 기록을 기록으로 쓰고 DB 필드는 비운다', () => {
        const history = [{ role: 'user' as const, content: 'prev' }];
        expect(guestTurn({ ...sendBody(null), history })).toEqual({
            repo: null,
            conversationId: null,
            userMessage: 'hello',
            userMessageId: null,
            userMessageSeq: null,
            history,
            portfolioSymbols: [],
        });
    });
});

describe('isConversationGone', () => {
    it('cause.code가 23503이면 true', () => {
        expect(isConversationGone({ cause: { code: '23503' } })).toBe(true);
    });

    it('다른 코드, cause 없음, null은 false', () => {
        expect(isConversationGone({ cause: { code: '23505' } })).toBe(false);
        expect(isConversationGone(new Error('x'))).toBe(false);
        expect(isConversationGone(null)).toBe(false);
    });
});

describe('prepareMemberTurn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repo.findForUser.mockResolvedValue({ id: 'c1', title: 't' });
        repo.create.mockResolvedValue({ id: 'c-new', title: '제목' });
        repo.countForUser.mockResolvedValue(0);
        repo.listMessages.mockResolvedValue([]);
        repo.supersedeAfterLastUser.mockResolvedValue({});
        repo.appendMessages.mockResolvedValue([{ id: 'u-1', seq: 1 }]);
        portfolio.findByUser.mockResolvedValue([{ symbol: 'AAPL' }]);
    });

    it('없는 대화 id는 404 not_found', async () => {
        repo.findForUser.mockResolvedValue(null);
        expect(
            await prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).toEqual({ status: 404, error: 'not_found' });
    });

    it('대화 없이 regenerate는 400 invalid_body', async () => {
        const body: ParsedBody = { ...sendBody(null), action: 'regenerate' };
        expect(await prepareMemberTurn('u1', body, 'member', 'ko')).toEqual({
            status: 400,
            error: 'invalid_body',
        });
    });

    it('새 대화가 한도에 닿으면 409 conversation_limit이고 생성하지 않는다', async () => {
        repo.countForUser.mockResolvedValue(100);
        expect(
            await prepareMemberTurn('u1', sendBody(null), 'member', 'ko')
        ).toEqual({ status: 409, error: 'conversation_limit' });
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('대화가 가득 차면 409 conversation_full이고 사용자 행을 저장하지 않는다', async () => {
        repo.listMessages.mockResolvedValue(
            Array.from({ length: 200 }, (_, i) => ROW(i + 1, 'user', 'x'))
        );
        expect(
            await prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).toEqual({ status: 409, error: 'conversation_full' });
        expect(repo.appendMessages).not.toHaveBeenCalled();
    });

    it('기존 대화 send: 사용자 행을 저장하고 id·seq·포트폴리오를 싣는다', async () => {
        repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q'),
            ROW(2, 'assistant', 'a'),
        ]);
        const out = await prepareMemberTurn('u1', sendBody(), 'member', 'ko');
        expect(out).toMatchObject({
            conversationId: 'c1',
            userMessage: 'hello',
            userMessageId: 'u-1',
            userMessageSeq: 1,
            portfolioSymbols: ['AAPL'],
        });
        expect(repo.appendMessages).toHaveBeenCalledWith('c1', [
            { role: 'user', content: 'hello' },
        ]);
    });

    it('새 대화 send: 대화를 만들고 제목을 싣는다', async () => {
        const out = await prepareMemberTurn(
            'u1',
            sendBody(null),
            'member',
            'ko'
        );
        expect(out).toMatchObject({ conversationId: 'c-new', title: '제목' });
        expect(repo.create).toHaveBeenCalledWith({
            userId: 'u1',
            firstMessage: 'hello',
            locale: 'ko',
            modelId: AGENT_MODEL,
        });
    });

    it('regenerate: 마지막 사용자 행을 질문으로 쓰고 기록에서 뺀다', async () => {
        repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
            ROW(3, 'user', 'q2'),
        ]);
        const body: ParsedBody = { ...sendBody(), action: 'regenerate' };
        const out = await prepareMemberTurn('u1', body, 'member', 'ko');
        expect(out).toMatchObject({
            userMessage: 'q2',
            userMessageId: null,
            history: [
                { role: 'user', content: 'q1' },
                { role: 'assistant', content: 'a1' },
            ],
        });
        expect(repo.appendMessages).not.toHaveBeenCalled();
    });

    it('regenerate: 대체할 사용자 행이 없으면 400 invalid_body', async () => {
        repo.supersedeAfterLastUser.mockResolvedValue(null);
        const body: ParsedBody = { ...sendBody(), action: 'regenerate' };
        expect(await prepareMemberTurn('u1', body, 'member', 'ko')).toEqual({
            status: 400,
            error: 'invalid_body',
        });
    });

    it('edit: 사용자 행을 가리키면 그 seq부터 지운다', async () => {
        repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
        ]);
        const body: ParsedBody = { ...sendBody(), action: 'edit', editSeq: 1 };
        await prepareMemberTurn('u1', body, 'member', 'ko');
        expect(repo.deleteFromSeq).toHaveBeenCalledWith('c1', 1);
    });

    it('edit: assistant 행을 가리키면 400 invalid_body이고 지우지 않는다', async () => {
        repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
        ]);
        const body: ParsedBody = { ...sendBody(), action: 'edit', editSeq: 2 };
        expect(await prepareMemberTurn('u1', body, 'member', 'ko')).toEqual({
            status: 400,
            error: 'invalid_body',
        });
        expect(repo.deleteFromSeq).not.toHaveBeenCalled();
    });

    it('저장 중 대화가 삭제되면(FK 위반) 404 not_found', async () => {
        repo.appendMessages.mockRejectedValue({ cause: { code: '23503' } });
        expect(
            await prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).toEqual({ status: 404, error: 'not_found' });
    });

    it('FK 위반이 아닌 저장 오류는 그대로 던진다', async () => {
        repo.appendMessages.mockRejectedValue(new Error('db down'));
        await expect(
            prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).rejects.toThrow('db down');
    });
});
