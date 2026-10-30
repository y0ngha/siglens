const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { createWithinLimit: mockCreate };
    }),
}));

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { createSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/createSiglensApiKeyAction';
import { hashApiKey } from '@/entities/siglens-api-key/server/apiKeyToken';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import {
    API_KEY_MAX_ACTIVE_PER_USER,
    API_KEY_NAME_MAX_LENGTH,
} from '@/shared/config/publicApi';
import { koMessage } from '@/shared/test-utils/koMessage';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const IDLE: CreateSiglensApiKeyState = { status: 'idle' };
const verifiedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    emailVerified: true,
} as never;

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCreate.mockImplementation(
        async (input: { name: string; keyPrefix: string }) => ({
            status: 'created',
            key: {
                id: '33333333-3333-4333-8333-333333333333',
                name: input.name,
                keyPrefix: input.keyPrefix,
                createdAt: new Date('2026-10-15T00:00:00Z'),
                lastUsedAt: null,
            },
        })
    );
});

describe('createSiglensApiKeyAction', () => {
    it('원문 키는 응답에만 있고 저장소에는 해시만 넘어간다', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name: '내 에이전트' })
        );
        if (result.status !== 'created') throw new Error('expected created');

        expect(result.rawKey).toMatch(/^slk_[0-9A-Za-z]{40}$/);
        const stored = mockCreate.mock.calls[0][0] as Record<string, unknown>;
        expect(stored.keyHash).toBe(hashApiKey(result.rawKey));
        // 저장 입력 어디에도 원문이 없다 — 값 전체를 훑는다.
        expect(Object.values(stored)).not.toContain(result.rawKey);
        expect(JSON.stringify(stored)).not.toContain(result.rawKey);
    });

    it('표시용 접두를 돌려주고 같은 값을 저장한다', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name: '내 에이전트' })
        );
        if (result.status !== 'created') throw new Error('expected created');
        expect(result.keyPrefix).toBe(result.rawKey.slice(0, 10));
        expect(mockCreate.mock.calls[0][0]).toMatchObject({
            keyPrefix: result.keyPrefix,
            userId: '11111111-1111-4111-8111-111111111111',
            name: '내 에이전트',
        });
    });

    it('상한을 설정 상수로 넘기고 계정 화면을 다시 그리게 한다', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        await createSiglensApiKeyAction(IDLE, makeFormData({ name: 'a' }));
        expect(mockCreate.mock.calls[0][1]).toBe(API_KEY_MAX_ACTIVE_PER_USER);
        expect(revalidatePath).toHaveBeenCalledWith(
            '/[locale]/account',
            'page'
        );
    });

    it('활성 키가 상한이면 limit_reached와 상한이 담긴 문구', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        mockCreate.mockResolvedValue({ status: 'limit_reached' });
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name: 'a' })
        );
        expect(result).toEqual({
            status: 'error',
            code: 'limit_reached',
            message: koMessage(
                'entities.siglens-api-key.action.limitReached'
            ).replace('{v0}', String(API_KEY_MAX_ACTIVE_PER_USER)),
        });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('비로그인은 저장소를 건드리지 않고 unauthenticated', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name: 'a' })
        );
        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('이메일 미인증 회원은 발급할 수 없다', async () => {
        mockGetCurrentUser.mockResolvedValue({
            id: 'u',
            emailVerified: false,
        } as never);
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name: 'a' })
        );
        expect(result).toMatchObject({
            status: 'error',
            code: 'email_not_verified',
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it.each([
        ['공백뿐', '   '],
        ['빈 값', ''],
        ['상한 초과', 'a'.repeat(API_KEY_NAME_MAX_LENGTH + 1)],
        ['제어 문자', 'a\nb'],
    ])('이름이 %s이면 invalid_name', async (_label, name) => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        const result = await createSiglensApiKeyAction(
            IDLE,
            makeFormData({ name })
        );
        expect(result).toMatchObject({ status: 'error', code: 'invalid_name' });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('이름 필드가 없으면 invalid_name', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        const result = await createSiglensApiKeyAction(IDLE, makeFormData({}));
        expect(result).toMatchObject({ status: 'error', code: 'invalid_name' });
    });

    it('저장소가 던져도 server_error 상태를 돌려준다(던지지 않는다)', async () => {
        mockGetCurrentUser.mockResolvedValue(verifiedUser);
        mockCreate.mockRejectedValue(new Error('db down'));
        await expect(
            createSiglensApiKeyAction(IDLE, makeFormData({ name: 'a' }))
        ).resolves.toMatchObject({ status: 'error', code: 'server_error' });
        expect(console.error).toHaveBeenCalled();
    });

    it('세션 조회가 던져도 server_error', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('db down'));
        await expect(
            createSiglensApiKeyAction(IDLE, makeFormData({ name: 'a' }))
        ).resolves.toMatchObject({ status: 'error', code: 'server_error' });
    });
});
