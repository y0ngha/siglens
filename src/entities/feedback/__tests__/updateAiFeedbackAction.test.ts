const { mockUpdate, mockRateLimit, mockUser } = vi.hoisted(() => ({
    mockUpdate: vi.fn(),
    mockRateLimit: vi.fn(),
    mockUser: vi.fn(),
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: () => mockUser(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('../api', () => ({
    DrizzleFeedbackRepository: function () {
        return { updateAiFeedback: mockUpdate };
    },
}));
vi.mock('../server/rateLimit', () => ({
    checkFeedbackRateLimit: mockRateLimit,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig<typeof import('@y0ngha/siglens-core')>()),
    hashUsageIp: vi.fn(() => 'ipHashX'),
}));

import { updateAiFeedbackAction } from '../actions/updateAiFeedbackAction';

const ID = '3f2b8c1e-9d4a-4e6b-8a1c-0123456789ab';

describe('updateAiFeedbackAction', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue(true);
        mockUpdate.mockResolvedValue(true);
        mockUser.mockResolvedValue(null);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => errorSpy.mockRestore());

    it('👎 사유·의견을 패치로 넘기고 ok 를 돌려준다', async () => {
        const result = await updateAiFeedbackAction({
            id: ID,
            vote: 'down',
            reasons: ['inaccurate'],
            comment: '틀림',
        });

        expect(result).toEqual({ ok: true });
        expect(mockUpdate).toHaveBeenCalledWith(
            ID,
            {
                vote: 'down',
                reasons: ['inaccurate'],
                comment: '틀림',
            },
            null
        );
    });

    it('회원이면 그 회원 id 를 행 소유자 조건으로 넘긴다', async () => {
        mockUser.mockResolvedValue({ id: 'user-1' });
        await updateAiFeedbackAction({ id: ID, vote: 'down' });
        expect(mockUpdate).toHaveBeenCalledWith(ID, { vote: 'down' }, 'user-1');
    });

    it('👍 로 바꾸면 사유·의견을 함께 지운다', async () => {
        await updateAiFeedbackAction({
            id: ID,
            vote: 'up',
            reasons: ['other'],
            comment: 'x',
        });
        expect(mockUpdate).toHaveBeenCalledWith(
            ID,
            { vote: 'up', reasons: null, comment: null },
            null
        );
    });

    it('빈 사유 배열과 빈 의견은 null 로 지운다', async () => {
        await updateAiFeedbackAction({ id: ID, reasons: [], comment: '  ' });
        expect(mockUpdate).toHaveBeenCalledWith(
            ID,
            { reasons: null, comment: null },
            null
        );
    });

    it('갱신된 행이 없으면 not_found 이다', async () => {
        mockUpdate.mockResolvedValue(false);
        expect(await updateAiFeedbackAction({ id: ID, vote: 'up' })).toEqual({
            ok: false,
            code: 'not_found',
        });
    });

    it('잘못된 입력은 invalid_input 이고 DB 를 건드리지 않는다', async () => {
        expect(await updateAiFeedbackAction({ id: 'x', vote: 'up' })).toEqual({
            ok: false,
            code: 'invalid_input',
        });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('ai_vote 버킷 한도 초과면 rate_limited 이다', async () => {
        mockRateLimit.mockResolvedValue(false);
        expect(await updateAiFeedbackAction({ id: ID, vote: 'up' })).toEqual({
            ok: false,
            code: 'rate_limited',
        });
        expect(mockRateLimit).toHaveBeenCalledWith('ai_vote', 'ipHashX');
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('저장소 오류는 submission_failed 로 감춘다', async () => {
        mockUpdate.mockRejectedValue(new Error('db lost'));
        expect(await updateAiFeedbackAction({ id: ID, vote: 'up' })).toEqual({
            ok: false,
            code: 'submission_failed',
        });
    });
});
