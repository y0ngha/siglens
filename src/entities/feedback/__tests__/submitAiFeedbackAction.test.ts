const { mockCreate, mockRateLimit, mockUser, mockFindForUser } = vi.hoisted(
    () => ({
        mockCreate: vi.fn(),
        mockRateLimit: vi.fn(),
        mockUser: vi.fn(),
        mockFindForUser: vi.fn(),
    })
);
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('../api', () => ({
    DrizzleFeedbackRepository: function () {
        return { create: mockCreate };
    },
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: function () {
        return { findForUser: mockFindForUser };
    },
}));
vi.mock('../server/rateLimit', () => ({
    checkFeedbackRateLimit: mockRateLimit,
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: mockUser,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));
vi.mock('@/shared/i18n/requestLocale', () => ({
    resolveRequestLocale: vi.fn().mockResolvedValue('ko'),
}));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig<typeof import('@y0ngha/siglens-core')>()),
    hashUsageIp: vi.fn(() => 'ipHashX'),
}));

import { submitAiFeedbackAction } from '../actions/submitAiFeedbackAction';

const CONV = '3f2b8c1e-9d4a-4e6b-8a1c-0123456789ab';
const MSG = '4a2b8c1e-9d4a-4e6b-8a1c-0123456789cd';

const analysisInput = {
    surface: 'siglens',
    vote: 'up',
    context: { analysisType: 'technical', symbol: 'AAPL', modelId: 'm' },
    snapshot: { summary: 's' },
    pagePath: '/AAPL?x=1',
};
const agentInput = {
    surface: 'siglens_ai',
    vote: 'down',
    context: {
        conversationId: CONV,
        messageId: MSG,
        messageIndex: 1,
        guest: true,
    },
    snapshot: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
    ],
    pagePath: '/c/x',
};

describe('submitAiFeedbackAction', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue(true);
        mockUser.mockResolvedValue(null);
        mockCreate.mockResolvedValue('fb-1');
        mockFindForUser.mockResolvedValue(null);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => errorSpy.mockRestore());

    it('분석 응답 평가를 target_type·symbol 비정규화와 함께 저장하고 id 를 돌려준다', async () => {
        const result = await submitAiFeedbackAction(analysisInput);

        expect(result).toEqual({ ok: true, id: 'fb-1' });
        expect(mockCreate).toHaveBeenCalledWith({
            kind: 'ai_response',
            surface: 'siglens',
            rating: null,
            vote: 'up',
            reasons: null,
            comment: null,
            targetType: 'technical',
            symbol: 'AAPL',
            context: {
                analysisType: 'technical',
                symbol: 'AAPL',
                modelId: 'm',
            },
            snapshot: { truncated: false, value: { summary: 's' } },
            userId: null,
            conversationId: null,
            pagePath: '/AAPL',
            locale: 'ko',
        });
    });

    it('스냅샷이 256KB 를 넘으면 절단 래퍼로 저장한다', async () => {
        await submitAiFeedbackAction({
            ...analysisInput,
            snapshot: { text: 'a'.repeat(400 * 1024) },
        });
        const record = mockCreate.mock.lastCall?.[0] as {
            snapshot: { truncated: boolean };
        };
        expect(record.snapshot.truncated).toBe(true);
    });

    it('회원 분석 평가는 user_id 를 채운다', async () => {
        mockUser.mockResolvedValue({ id: 'user-1' });
        await submitAiFeedbackAction(analysisInput);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1' })
        );
    });

    it('비회원 챗 평가는 conversation_id·messageId 를 저장하지 않고 guest:true 로 둔다', async () => {
        await submitAiFeedbackAction(agentInput);

        expect(mockFindForUser).not.toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                targetType: 'agent_message',
                symbol: null,
                userId: null,
                conversationId: null,
                context: { messageIndex: 1, guest: true },
            })
        );
    });

    it('회원 본인 대화면 conversation_id 와 messageId 를 연결하고 guest 를 false 로 덮어쓴다', async () => {
        mockUser.mockResolvedValue({ id: 'user-1' });
        mockFindForUser.mockResolvedValue({ id: CONV });

        await submitAiFeedbackAction(agentInput);

        expect(mockFindForUser).toHaveBeenCalledWith(CONV, 'user-1');
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                conversationId: CONV,
                context: {
                    messageIndex: 1,
                    guest: false,
                    conversationId: CONV,
                    messageId: MSG,
                },
            })
        );
    });

    it('남의 대화 id 면 conversation_id 를 null 로 두고 context 에서도 뺀다', async () => {
        mockUser.mockResolvedValue({ id: 'user-1' });
        mockFindForUser.mockResolvedValue(null);

        await submitAiFeedbackAction(agentInput);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                conversationId: null,
                context: { messageIndex: 1, guest: false },
            })
        );
    });

    it('ai_vote 버킷으로 rate limit 을 건다', async () => {
        await submitAiFeedbackAction(analysisInput);
        expect(mockRateLimit).toHaveBeenCalledWith('ai_vote', 'ipHashX');
    });

    it('한도 초과면 rate_limited 이고 저장하지 않는다', async () => {
        mockRateLimit.mockResolvedValue(false);
        expect(await submitAiFeedbackAction(analysisInput)).toEqual({
            ok: false,
            code: 'rate_limited',
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('잘못된 입력은 invalid_input 이다', async () => {
        expect(
            await submitAiFeedbackAction({ ...analysisInput, vote: 'meh' })
        ).toEqual({ ok: false, code: 'invalid_input' });
    });

    it('저장 실패는 submission_failed 이고 스냅샷 본문을 로그에 남기지 않는다', async () => {
        mockCreate.mockRejectedValue(
            new Error('insert params: secret-snapshot')
        );
        expect(await submitAiFeedbackAction(analysisInput)).toEqual({
            ok: false,
            code: 'submission_failed',
        });
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
            'secret-snapshot'
        );
    });
});
