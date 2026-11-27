const { repo, portfolio, RepoCtor, PortfolioCtor } = vi.hoisted(() => {
    const repo = {
        create: vi.fn(),
        findForUser: vi.fn(),
        listMessages: vi.fn(),
        appendMessages: vi.fn(),
        appendUserMessage: vi.fn(),
        listImagesOfMessage: vi.fn(),
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    images: [],
});

const IMG = (n: number) => ({
    mediaType: 'image/webp' as const,
    bytes: Buffer.alloc(n, 1),
    width: n,
    height: n,
});
const REF = { id: 'img-1', width: 4, height: 4 };

describe('guestTurn', () => {
    it('브라우저가 보낸 기록을 기록으로 쓰고 DB 필드는 비운다', () => {
        const history = [{ role: 'user' as const, content: 'prev' }];
        expect(guestTurn({ ...sendBody(null), history })).toEqual({
            repo: null,
            conversationId: null,
            userMessage: 'hello',
            userImages: [],
            userMessageId: null,
            userMessageSeq: null,
            turnAtRowId: null,
            history,
            earlierAnalyses: [],
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
        repo.appendUserMessage.mockResolvedValue({ id: 'u-1', seq: 1 });
        repo.listImagesOfMessage.mockResolvedValue([IMG(7)]);
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
        expect(repo.appendUserMessage).not.toHaveBeenCalled();
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
            turnAtRowId: 'u-1',
            portfolioSymbols: ['AAPL'],
        });
        expect(repo.appendUserMessage).toHaveBeenCalledWith('c1', 'hello', []);
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
            hasImages: false,
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
            // 다시 쓰는 마지막 user 행 — 그 행의 옛 시계 메모를 이번 턴 메모로 덮어쓴다.
            turnAtRowId: ROW(3, 'user', 'q2').id,
            history: [
                { role: 'user', content: 'q1' },
                { role: 'assistant', content: 'a1' },
            ],
        });
        expect(repo.appendUserMessage).not.toHaveBeenCalled();
        expect(repo.listImagesOfMessage).not.toHaveBeenCalled();
    });

    describe('earlierAnalyses (이 대화의 이전 분석)', () => {
        const ANALYSIS = {
            found: true,
            tab: 'technical',
            timeframe: '1Day',
            generatedAt: '2026-11-18T14:00:00.000Z',
            analysis: { trend: 'bullish' },
        };
        const callRow = (seq: number) => ({
            ...ROW(seq, 'assistant', ''),
            toolCalls: [
                {
                    id: 'call_0',
                    name: 'get_cached_analysis',
                    args: { symbol: 'AAPL', tab: 'technical' },
                },
            ],
        });
        const resultRow = (seq: number) => ({
            ...ROW(seq, 'assistant', JSON.stringify(ANALYSIS)),
            role: 'tool' as const,
            toolCallId: 'call_0',
            toolName: 'get_cached_analysis',
        });

        it('저장된 이전 턴의 일봉 분석을 읽어 싣는다', async () => {
            repo.listMessages.mockResolvedValue([
                ROW(1, 'user', 'AAPL 분석'),
                callRow(2),
                resultRow(3),
                ROW(4, 'assistant', '답'),
            ]);
            const out = await prepareMemberTurn(
                'u1',
                sendBody(),
                'member',
                'ko'
            );
            expect(out).toMatchObject({
                earlierAnalyses: [
                    {
                        symbol: 'AAPL',
                        generatedAt: ANALYSIS.generatedAt,
                        analysis: ANALYSIS.analysis,
                        seq: 3,
                    },
                ],
            });
        });

        it('edit: 지워질 구간(editSeq 이상)의 분석은 기준으로 쓰지 않는다', async () => {
            repo.listMessages.mockResolvedValue([
                ROW(1, 'user', 'q'),
                callRow(2),
                resultRow(3),
                ROW(4, 'user', 'q2'),
            ]);
            const body: ParsedBody = {
                ...sendBody(),
                action: 'edit',
                editSeq: 1,
            };
            const out = await prepareMemberTurn('u1', body, 'member', 'ko');
            expect(out).toMatchObject({ earlierAnalyses: [] });
        });

        it('superseded 행의 분석은 읽지 않는다', async () => {
            repo.listMessages.mockResolvedValue([
                ROW(1, 'user', 'q'),
                { ...callRow(2), status: 'superseded' as const },
                { ...resultRow(3), status: 'superseded' as const },
            ]);
            const out = await prepareMemberTurn(
                'u1',
                { ...sendBody(), action: 'regenerate' },
                'member',
                'ko'
            );
            expect(out).toMatchObject({ earlierAnalyses: [] });
        });
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
        repo.appendUserMessage.mockRejectedValue({ cause: { code: '23503' } });
        expect(
            await prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).toEqual({ status: 404, error: 'not_found' });
    });

    it('FK 위반이 아닌 저장 오류는 그대로 던진다', async () => {
        repo.appendUserMessage.mockRejectedValue(new Error('db down'));
        await expect(
            prepareMemberTurn('u1', sendBody(), 'member', 'ko')
        ).rejects.toThrow('db down');
    });

    describe('이미지', () => {
        const withImages = (over: Partial<ParsedBody>): ParsedBody =>
            ({ ...sendBody(), ...over }) as ParsedBody;

        it('send: 정규화한 이미지를 user 행과 함께 저장하고 모델 입력에도 싣는다', async () => {
            const images = [IMG(2), IMG(3)];
            const out = await prepareMemberTurn(
                'u1',
                sendBody(),
                'member',
                'ko',
                images
            );
            expect(repo.appendUserMessage).toHaveBeenCalledWith(
                'c1',
                'hello',
                images
            );
            expect(out).toMatchObject({ userImages: images });
        });

        it('새 대화 send: 이미지가 있으면 hasImages로 제목을 정한다', async () => {
            await prepareMemberTurn('u1', sendBody(null), 'member', 'ko', [
                IMG(1),
            ]);
            expect(repo.create).toHaveBeenCalledWith(
                expect.objectContaining({ hasImages: true })
            );
        });

        it('저장 실패는 던져 턴이 시작되지 않는다(이미지 없이 저장하는 폴백 없음)', async () => {
            repo.appendUserMessage.mockRejectedValue(new Error('image insert'));
            await expect(
                prepareMemberTurn('u1', sendBody(), 'member', 'ko', [IMG(1)])
            ).rejects.toThrow('image insert');
            expect(repo.appendMessages).not.toHaveBeenCalled();
        });

        it('regenerate: 마지막 user 행의 이미지를 DB에서 다시 읽어 싣는다', async () => {
            repo.listMessages.mockResolvedValue([
                { ...ROW(1, 'user', 'q1'), images: [REF] },
                ROW(2, 'assistant', 'a1'),
            ]);
            const stored = [IMG(5)];
            repo.listImagesOfMessage.mockResolvedValue(stored);
            const out = await prepareMemberTurn(
                'u1',
                withImages({ action: 'regenerate' }),
                'member',
                'ko'
            );
            expect(repo.listImagesOfMessage).toHaveBeenCalledWith('m1');
            expect(out).toMatchObject({
                userMessage: 'q1',
                userImages: stored,
            });
            expect(repo.appendUserMessage).not.toHaveBeenCalled();
        });

        it('regenerate: 이미지가 없던 질문은 이미지를 읽지 않는다', async () => {
            repo.listMessages.mockResolvedValue([
                { ...ROW(1, 'user', 'q1'), images: [] },
                ROW(2, 'assistant', 'a1'),
            ]);
            const out = await prepareMemberTurn(
                'u1',
                withImages({ action: 'regenerate' }),
                'member',
                'ko'
            );
            expect(repo.listImagesOfMessage).not.toHaveBeenCalled();
            expect(out).toMatchObject({ userImages: [] });
        });

        it('edit: 대상 행의 이미지를 지우기 전에 읽어 새 user 행에 다시 저장한다', async () => {
            repo.listMessages.mockResolvedValue([
                { ...ROW(1, 'user', 'q1'), images: [REF] },
                ROW(2, 'assistant', 'a1'),
            ]);
            const stored = [IMG(6)];
            repo.listImagesOfMessage.mockResolvedValue(stored);
            await prepareMemberTurn(
                'u1',
                withImages({ action: 'edit', editSeq: 1, message: '수정' }),
                'member',
                'ko'
            );
            const readOrder =
                repo.listImagesOfMessage.mock.invocationCallOrder[0];
            const deleteOrder = repo.deleteFromSeq.mock.invocationCallOrder[0];
            expect(readOrder).toBeDefined();
            expect(deleteOrder).toBeDefined();
            expect(readOrder ?? Infinity).toBeLessThan(deleteOrder ?? 0);
            expect(repo.listImagesOfMessage).toHaveBeenCalledWith('m1');
            expect(repo.appendUserMessage).toHaveBeenCalledWith(
                'c1',
                '수정',
                stored
            );
        });

        it('edit: 대화 전체 읽기는 한 번뿐이고 이력은 편집 행 앞까지만 남긴다', async () => {
            repo.listMessages.mockResolvedValue([
                ROW(1, 'user', 'q1'),
                ROW(2, 'assistant', 'a1'),
                { ...ROW(3, 'user', 'q2'), images: [REF] },
                ROW(4, 'assistant', 'a2'),
            ]);
            repo.listImagesOfMessage.mockResolvedValue([IMG(6)]);
            const out = await prepareMemberTurn(
                'u1',
                withImages({ action: 'edit', editSeq: 3, message: '수정' }),
                'member',
                'ko'
            );
            expect(repo.listMessages).toHaveBeenCalledTimes(1);
            expect(repo.listImagesOfMessage).toHaveBeenCalledWith('m3');
            expect(out).toMatchObject({
                history: [
                    { role: 'user', content: 'q1' },
                    { role: 'assistant', content: 'a1' },
                ],
            });
        });

        it('edit: 본문에 이미지가 있으면 승계하지 않고 그것으로 대체한다', async () => {
            repo.listMessages.mockResolvedValue([
                { ...ROW(1, 'user', 'q1'), images: [REF] },
                ROW(2, 'assistant', 'a1'),
            ]);
            const fresh = [IMG(9)];
            await prepareMemberTurn(
                'u1',
                withImages({ action: 'edit', editSeq: 1, message: '수정' }),
                'member',
                'ko',
                fresh
            );
            expect(repo.listImagesOfMessage).not.toHaveBeenCalled();
            expect(repo.appendUserMessage).toHaveBeenCalledWith(
                'c1',
                '수정',
                fresh
            );
        });

        it('guestTurn: 본문 이미지를 그대로 싣는다', () => {
            const images = [IMG(2)];
            expect(guestTurn(sendBody(null), images).userImages).toBe(images);
        });
    });
});
