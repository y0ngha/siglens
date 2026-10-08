import type { MockedFunction } from 'vitest';

const { mockFindByUser, mockUpsert } = vi.hoisted(() => ({
    mockFindByUser: vi.fn(),
    mockUpsert: vi.fn(),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/shared/i18n/requestLocale', () => ({
    resolveRequestLocale: vi.fn(),
}));
vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportSubscriptionRepository: vi
        .fn()
        .mockImplementation(function () {
            return { findByUser: mockFindByUser, upsert: mockUpsert };
        }),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { getEmailReportSettingsAction } from '@/entities/email-report/actions/getEmailReportSettingsAction';
import { saveEmailReportSettingsAction } from '@/entities/email-report/actions/saveEmailReportSettingsAction';
import type { RawEmailReportSettingsInput } from '@/entities/email-report/model';
import type { EmailReportSubscriptionRecord } from '@/shared/db/types';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveRequestLocale = resolveRequestLocale as MockedFunction<
    typeof resolveRequestLocale
>;

const AUTHED_USER = { id: 'user-1', email: 'test@example.com' } as never;

const RECORD: EmailReportSubscriptionRecord = {
    userId: 'user-1',
    enabled: true,
    daysOfWeek: 0b0100010,
    sendHour: 21,
    timezone: 'America/New_York',
    locale: 'en',
    consentedAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
};

const INPUT: RawEmailReportSettingsInput = {
    enabled: true,
    daysOfWeek: [5, 1],
    sendHour: 21,
    timezone: 'America/New_York',
};

describe('getEmailReportSettingsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인이면 null이고 조회하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        await expect(getEmailReportSettingsAction()).resolves.toBeNull();
        expect(mockFindByUser).not.toHaveBeenCalled();
    });

    it('저장된 행이 없으면 기본값(isSaved false)을 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockResolvedValue(null);

        const result = await getEmailReportSettingsAction();

        expect(mockFindByUser).toHaveBeenCalledWith('user-1');
        expect(result).toMatchObject({ enabled: false, isSaved: false });
    });

    it('저장된 행을 화면 값으로 풀어 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockResolvedValue(RECORD);

        await expect(getEmailReportSettingsAction()).resolves.toEqual({
            enabled: true,
            daysOfWeek: [1, 5],
            sendHour: 21,
            timezone: 'America/New_York',
            isSaved: true,
        });
    });

    it('조회 실패는 삼키지 않고 던진다 — 기본값으로 덮으면 저장 시 실제 설정을 지운다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockRejectedValue(new Error('DB down'));

        await expect(getEmailReportSettingsAction()).rejects.toThrow('DB down');
    });
});

describe('saveEmailReportSettingsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveRequestLocale.mockResolvedValue('ja');
        mockUpsert.mockResolvedValue(RECORD);
    });

    it('비로그인이면 unauthenticated 오류이고 저장하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await saveEmailReportSettingsAction(INPUT);

        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it.each([
        ['null', null],
        ['enabled가 문자열', { ...INPUT, enabled: 'yes' }],
        ['daysOfWeek가 배열이 아님', { ...INPUT, daysOfWeek: '1' }],
        ['sendHour가 문자열', { ...INPUT, sendHour: '8' }],
        ['timezone 누락', { ...INPUT, timezone: undefined }],
    ])('모양이 틀린 입력(%s)은 invalid_input', async (_, input) => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await saveEmailReportSettingsAction(input as never);

        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_input',
        });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('검증 실패 코드를 그대로 돌려주고 저장하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await saveEmailReportSettingsAction({
            ...INPUT,
            sendHour: 24,
        });

        expect(result).toMatchObject({ status: 'error', code: 'invalid_hour' });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('요일을 비트마스크로, 로케일을 요청 로케일로 저장하고 저장된 설정을 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await saveEmailReportSettingsAction(INPUT);

        expect(mockUpsert).toHaveBeenCalledWith({
            userId: 'user-1',
            enabled: true,
            daysOfWeek: 0b0100010,
            sendHour: 21,
            timezone: 'America/New_York',
            locale: 'ja',
        });
        expect(result).toEqual({
            status: 'ok',
            settings: {
                enabled: true,
                daysOfWeek: [1, 5],
                sendHour: 21,
                timezone: 'America/New_York',
                isSaved: true,
            },
        });
    });

    it('저장 실패는 던지지 않고 storage_unavailable로 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockUpsert.mockRejectedValue(new Error('DB down'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await saveEmailReportSettingsAction(INPUT);

        expect(result).toMatchObject({
            status: 'error',
            code: 'storage_unavailable',
        });
    });
});
