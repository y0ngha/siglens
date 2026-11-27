vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/logActionError', () => ({ logActionError: vi.fn() }));

vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportSubscriptionRepository: vi
        .fn()
        .mockImplementation(function () {
            return { upsert: mockUpsert };
        }),
}));

import { recordSignupEmailReportOptIn } from '@/entities/email-report/server/recordSignupEmailReportOptIn';
import type { SiglensDatabase } from '@/shared/db/types';
import { logActionError } from '@/shared/lib/logActionError';

const mockUpsert = vi.fn();

const DB = {} as SiglensDatabase;

describe('recordSignupEmailReportOptIn', () => {
    beforeEach(() => {
        mockUpsert.mockReset();
        vi.mocked(logActionError).mockClear();
    });

    it('월요일 오전 8시 기본 일정과 입력의 시간대·로케일·화면으로 켠 구독을 저장한다', async () => {
        mockUpsert.mockResolvedValue({});

        await expect(
            recordSignupEmailReportOptIn(DB, {
                userId: 'user-1',
                timezone: 'America/New_York',
                locale: 'en',
                source: 'signup_email',
            })
        ).resolves.toBe(true);

        expect(mockUpsert).toHaveBeenCalledWith({
            userId: 'user-1',
            enabled: true,
            daysOfWeek: 0b0000010,
            sendHour: 8,
            timezone: 'America/New_York',
            locale: 'en',
            consentSource: 'signup_email',
        });
    });

    it('소셜 가입 화면의 출처도 그대로 기록한다', async () => {
        mockUpsert.mockResolvedValue({});

        await recordSignupEmailReportOptIn(DB, {
            userId: 'user-2',
            timezone: 'Asia/Seoul',
            locale: 'ko',
            source: 'signup_oauth',
        });

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ consentSource: 'signup_oauth' })
        );
    });

    it('저장이 던져도 던지지 않고 기록만 남긴 뒤 false를 돌려준다', async () => {
        const failure = new Error('db down');
        mockUpsert.mockRejectedValue(failure);

        await expect(
            recordSignupEmailReportOptIn(DB, {
                userId: 'user-1',
                timezone: 'Asia/Seoul',
                locale: 'ko',
                source: 'signup_email',
            })
        ).resolves.toBe(false);

        expect(logActionError).toHaveBeenCalledWith(
            '[recordSignupEmailReportOptIn] upsert failed',
            failure
        );
    });
});
