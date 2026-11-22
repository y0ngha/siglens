const mocks = vi.hoisted(() => ({
    rateLimit: vi.fn(),
    del: vi.fn(),
    redisPair: { value: true },
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisReaderWriter: () =>
        mocks.redisPair.value ? { writer: { del: mocks.del } } : null,
}));
vi.mock('@y0ngha/siglens-core', () => ({
    hashUsageIp: (ip: string) => `hash(${ip})`,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: async () => '203.0.113.9',
}));
vi.mock('@/shared/cache/fixedWindowRateLimit', () => ({
    checkFixedWindowRateLimit: mocks.rateLimit,
}));

import { createEmailVerificationGuards } from '@/entities/auth/server/createEmailVerificationGuards';

beforeEach(() => {
    mocks.rateLimit.mockReset().mockResolvedValue(true);
    mocks.del.mockReset().mockResolvedValue(1);
    mocks.redisPair.value = true;
});

describe('createEmailVerificationGuards', () => {
    it('rateLimit은 규칙에 로그 이름을 붙여 공용 헬퍼로 보낸다', async () => {
        const guards = createEmailVerificationGuards();

        await expect(
            guards.rateLimit({ key: 'k', limit: 3, windowSeconds: 60 })
        ).resolves.toBe(true);
        expect(mocks.rateLimit).toHaveBeenCalledWith({
            key: 'k',
            limit: 3,
            windowSeconds: 60,
            logTag: 'signupEmailCodeRateLimit',
        });
    });

    it('rateLimit은 공용 헬퍼의 거부를 그대로 돌려준다', async () => {
        mocks.rateLimit.mockResolvedValue(false);
        const guards = createEmailVerificationGuards();

        await expect(
            guards.rateLimit({ key: 'k', limit: 1, windowSeconds: 60 })
        ).resolves.toBe(false);
    });

    it('resetCounter는 Redis 키를 지우고, Redis가 없으면 아무 일도 하지 않는다', async () => {
        const guards = createEmailVerificationGuards();

        await guards.resetCounter('auth:signup-verify:e:abc');
        expect(mocks.del).toHaveBeenCalledWith('auth:signup-verify:e:abc');

        mocks.redisPair.value = false;
        await expect(guards.resetCounter('k')).resolves.toBeUndefined();
        expect(mocks.del).toHaveBeenCalledTimes(1);
    });

    it('ipHash는 원본 IP가 아니라 해시다', async () => {
        const guards = createEmailVerificationGuards();

        await expect(guards.ipHash()).resolves.toBe('hash(203.0.113.9)');
    });
});
