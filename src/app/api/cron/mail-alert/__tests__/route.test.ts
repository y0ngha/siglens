vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/auth/isAuthorizedCronRequest', () => ({
    isAuthorizedCronRequest: vi.fn(),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn() }));
vi.mock('@/shared/email/dispatcher', () => ({
    createEmailDispatcher: vi.fn(() => ({ sendEmail: vi.fn() })),
}));
vi.mock('@/app/api/cron/mail-alert/scheduleMailAlertPass', () => ({
    scheduleMailAlertPass: vi.fn(),
}));

import { PATCH } from '@/app/api/cron/mail-alert/route';
import { scheduleMailAlertPass } from '@/app/api/cron/mail-alert/scheduleMailAlertPass';
import { isE2E } from '@/shared/api/e2eEnv';
import { ThrottledEmailDispatcher } from '@/shared/email/ThrottledEmailDispatcher';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';

const request = (headers: Record<string, string> = {}) =>
    new Request('https://siglens.io/api/cron/mail-alert', {
        method: 'PATCH',
        headers,
    });

function scheduledNow(): Date | undefined {
    return vi.mocked(scheduleMailAlertPass).mock.lastCall?.[0].now;
}

describe('PATCH /api/cron/mail-alert', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(true);
        vi.mocked(isE2E).mockReturnValue(false);
    });

    it('인증이 없으면 401이고 패스를 예약하지 않는다', async () => {
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(false);

        const res = await PATCH(request());

        expect(res.status).toBe(401);
        expect(scheduleMailAlertPass).not.toHaveBeenCalled();
    });

    it('202를 돌려주고 속도 제한 발송기로 패스를 예약한다', async () => {
        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(scheduleMailAlertPass).toHaveBeenCalledTimes(1);
        expect(
            vi.mocked(scheduleMailAlertPass).mock.lastCall?.[0].dispatcher
        ).toBeInstanceOf(ThrottledEmailDispatcher);
    });

    it('운영에서는 시각 재정의 헤더를 무시한다', async () => {
        const before = Date.now();

        await PATCH(request({ 'x-siglens-e2e-now': '2026-11-24T22:05:00Z' }));

        expect(scheduledNow()?.getTime()).toBeGreaterThanOrEqual(before);
        expect(scheduledNow()?.toISOString()).not.toBe(
            '2026-11-24T22:05:00.000Z'
        );
    });

    it('E2E에서는 헤더의 시각을 시계로 쓴다', async () => {
        vi.mocked(isE2E).mockReturnValue(true);

        await PATCH(request({ 'x-siglens-e2e-now': '2026-11-24T22:05:00Z' }));

        expect(scheduledNow()?.toISOString()).toBe('2026-11-24T22:05:00.000Z');
    });

    it('E2E에서도 헤더가 없거나 시각이 아니면 현재 시각이다', async () => {
        vi.mocked(isE2E).mockReturnValue(true);
        const before = Date.now();

        await PATCH(request());
        const withoutHeader = scheduledNow()?.getTime() ?? 0;
        await PATCH(request({ 'x-siglens-e2e-now': 'yesterday' }));
        const invalid = scheduledNow()?.getTime() ?? 0;

        expect(withoutHeader).toBeGreaterThanOrEqual(before);
        expect(invalid).toBeGreaterThanOrEqual(before);
    });
});
