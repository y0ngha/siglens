const { mockCreate, mockRateLimit, mockUser, mockNotify } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockRateLimit: vi.fn(),
    mockUser: vi.fn(),
    mockNotify: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('../api', () => ({
    DrizzleFeedbackRepository: function () {
        return { create: mockCreate };
    },
}));
vi.mock('../server/rateLimit', () => ({
    checkFeedbackRateLimit: mockRateLimit,
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: mockUser,
}));
vi.mock('@/shared/email/operatorNotifier', () => ({
    scheduleOperatorNotification: mockNotify,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));
vi.mock('@/shared/i18n/requestLocale', () => ({
    resolveRequestLocale: vi.fn().mockResolvedValue('en'),
}));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig<typeof import('@y0ngha/siglens-core')>()),
    hashUsageIp: vi.fn(() => 'ipHashX'),
}));

import { submitVocFeedbackAction } from '../actions/submitVocFeedbackAction';

const input = {
    surface: 'siglens',
    rating: 5,
    comment: '좋아요',
    trigger: 'analysis',
    pagePath: '/AAPL?q=1',
};

describe('submitVocFeedbackAction', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue(true);
        mockUser.mockResolvedValue(null);
        mockCreate.mockResolvedValue('id-1');
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => errorSpy.mockRestore());

    it('비회원 VOC 를 식별자 없이 저장하고 ok 를 돌려준다', async () => {
        const result = await submitVocFeedbackAction(input);

        expect(result).toEqual({ ok: true });
        expect(mockCreate).toHaveBeenCalledWith({
            kind: 'voc',
            surface: 'siglens',
            rating: 5,
            vote: null,
            reasons: null,
            comment: '좋아요',
            targetType: null,
            symbol: null,
            context: { trigger: 'analysis' },
            snapshot: null,
            userId: null,
            conversationId: null,
            pagePath: '/AAPL',
            locale: 'en',
        });
    });

    it('회원이면 user_id 를 채운다', async () => {
        mockUser.mockResolvedValue({ id: 'user-1' });
        await submitVocFeedbackAction(input);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1' })
        );
    });

    it('voc 버킷으로 IP 해시 rate limit 을 건다', async () => {
        await submitVocFeedbackAction(input);
        expect(mockRateLimit).toHaveBeenCalledWith('voc', 'ipHashX');
    });

    it('한도 초과면 rate_limited 이고 저장하지 않는다', async () => {
        mockRateLimit.mockResolvedValue(false);
        expect(await submitVocFeedbackAction(input)).toEqual({
            ok: false,
            code: 'rate_limited',
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('잘못된 입력은 invalid_input 이고 rate limit 도 쓰지 않는다', async () => {
        expect(await submitVocFeedbackAction({ ...input, rating: 9 })).toEqual({
            ok: false,
            code: 'invalid_input',
        });
        expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it('저장 후 운영자에게 별점·의견이 담긴 메일을 보낸다', async () => {
        await submitVocFeedbackAction(input);
        expect(mockNotify).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: '[SIGLENS] 새 VOC 별점 5/5',
                text: expect.stringContaining('좋아요'),
            }),
            '[submitVocFeedbackAction]'
        );
    });

    it('저장이 실패하면 submission_failed 를 돌려주고 메일을 보내지 않는다', async () => {
        mockCreate.mockRejectedValue(new Error('db lost'));
        expect(await submitVocFeedbackAction(input)).toEqual({
            ok: false,
            code: 'submission_failed',
        });
        expect(mockNotify).not.toHaveBeenCalled();
    });
});
