const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));
vi.mock('@/shared/cache/fixedWindowRateLimit', () => ({
    checkFixedWindowRateLimit: mockCheck,
}));

import { checkFeedbackRateLimit } from '../server/rateLimit';

describe('checkFeedbackRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheck.mockResolvedValue(true);
    });

    it.each([
        ['voc', 5],
        ['ai_vote', 120],
    ] as const)(
        '%s 는 버킷별 키와 시간당 %i 회 한도로 위임한다',
        async (bucket, limit) => {
            await checkFeedbackRateLimit(bucket, 'h');
            expect(mockCheck).toHaveBeenCalledWith({
                key: `feedback:rl:${bucket}:h`,
                limit,
                windowSeconds: 3600,
                logTag: 'checkFeedbackRateLimit',
            });
        }
    );

    it('공유 구현의 판정을 그대로 돌려준다', async () => {
        mockCheck.mockResolvedValueOnce(false);
        expect(await checkFeedbackRateLimit('voc', 'h')).toBe(false);
        mockCheck.mockResolvedValueOnce(true);
        expect(await checkFeedbackRateLimit('voc', 'h')).toBe(true);
    });
});
