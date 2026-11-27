const mocks = vi.hoisted(() => ({
    secret: { value: 'a'.repeat(40) as string | null },
    rateLimit: vi.fn(),
    emailTokens: { marker: 'tokens' },
    del: vi.fn(),
    redisPair: { value: true },
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisReaderWriter: () =>
        mocks.redisPair.value ? { writer: { del: mocks.del } } : null,
}));
vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    hashUsageIp: (ip: string) => `hash(${ip})`,
}));
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn(function () {
        return { marker: 'users' };
    }),
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: () => mocks.secret.value,
}));
vi.mock('@/entities/email-token/api', () => ({
    createEmailTokenStore: () => mocks.emailTokens,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: async () => '203.0.113.9',
}));
vi.mock('@/shared/cache/fixedWindowRateLimit', () => ({
    checkFixedWindowRateLimit: mocks.rateLimit,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/shared/email/dispatcher', () => ({
    createEmailDispatcher: () => ({ marker: 'dispatcher' }),
}));
vi.mock('@/shared/i18n/requestLocale', () => ({
    resolveRequestLocale: async () => 'ko',
}));
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzleMailAlertSubscriberRepository: vi.fn(function () {
        return { marker: 'subscribers' };
    }),
    DrizzlePriceAlertRepository: vi.fn(function () {
        return { marker: 'price-alerts' };
    }),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { signReportValue } from '@/entities/email-report/lib/reportSignature';
import { createMailAlertDeps } from '@/entities/mail-alert/server/createMailAlertDeps';

const ID = '3f2b8a1e-6c4d-4e5f-9a7b-1c2d3e4f5a6b';

beforeEach(() => {
    mocks.secret.value = 'a'.repeat(40);
    mocks.rateLimit.mockReset().mockResolvedValue(true);
    mocks.del.mockReset().mockResolvedValue(1);
    mocks.redisPair.value = true;
});

describe('createMailAlertDeps', () => {
    it('공개 스위치는 꺼져 있고, 서명 비밀이 있으면 signingReady다', async () => {
        const deps = await createMailAlertDeps();

        expect(deps.launched).toBe(false);
        expect(deps.signingReady).toBe(true);
        expect(deps.locale).toBe('ko');
        expect(deps.emailTokens).toBe(mocks.emailTokens);
    });

    it('가격대 알림 저장소를 싣고, 공개 스위치가 꺼져 있는 동안 알림 설정은 닫혀 있다', async () => {
        const deps = await createMailAlertDeps();

        expect(deps.priceAlerts).toEqual({ marker: 'price-alerts' });
        expect(deps.priceAlertsEnabled).toBe(false);
    });

    it('서명 비밀이 없으면 signingReady가 거짓이고 어떤 링크도 맞지 않는다', async () => {
        mocks.secret.value = null;
        const deps = await createMailAlertDeps();

        expect(deps.signingReady).toBe(false);
        expect(deps.verifyLink({ s: ID, sig: 'anything' })).toBe(false);
    });

    it('verifyLink는 alert-manage 서명과 UUID 모양을 모두 요구한다', async () => {
        const secret = mocks.secret.value ?? '';
        const deps = await createMailAlertDeps();

        expect(
            deps.verifyLink({
                s: ID,
                sig: signReportValue(secret, 'alert-manage', ID),
            })
        ).toBe(true);
        // 쿠키 용도의 서명은 설정 링크로 쓸 수 없다.
        expect(
            deps.verifyLink({
                s: ID,
                sig: signReportValue(secret, 'alert-session', ID),
            })
        ).toBe(false);
        expect(
            deps.verifyLink({
                s: 'not-a-uuid',
                sig: signReportValue(secret, 'alert-manage', 'not-a-uuid'),
            })
        ).toBe(false);
    });

    it('rateLimit은 규칙에 로그 이름을 붙여 공용 헬퍼로 보낸다', async () => {
        const deps = await createMailAlertDeps();

        await expect(
            deps.rateLimit({ key: 'k', limit: 3, windowSeconds: 60 })
        ).resolves.toBe(true);
        expect(mocks.rateLimit).toHaveBeenCalledWith({
            key: 'k',
            limit: 3,
            windowSeconds: 60,
            logTag: 'mailAlertRateLimit',
        });
    });

    it('resetCounter는 Redis 키를 지우고, Redis가 없으면 아무 일도 하지 않는다', async () => {
        const deps = await createMailAlertDeps();

        await deps.resetCounter('mail-alert:verify:e:abc');
        expect(mocks.del).toHaveBeenCalledWith('mail-alert:verify:e:abc');

        mocks.redisPair.value = false;
        await expect(deps.resetCounter('k')).resolves.toBeUndefined();
        expect(mocks.del).toHaveBeenCalledTimes(1);
    });

    it('ipHash는 원본 IP가 아니라 해시다', async () => {
        const deps = await createMailAlertDeps();

        await expect(deps.ipHash()).resolves.toBe('hash(203.0.113.9)');
    });

    it('코드 메일은 요청 로케일과 받는 주소로 만든다', async () => {
        const deps = await createMailAlertDeps();

        const message = deps.buildCodeMessage('a@example.com', '123456');

        expect(message.to).toBe('a@example.com');
        expect(message.html).toContain('123456');
    });
});
