const { mockSetModel, mockFindProviders } = vi.hoisted(() => ({
    mockSetModel: vi.fn(),
    mockFindProviders: vi.fn(),
}));

vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { setApiDefaultModel: mockSetModel };
    }),
}));
vi.mock('@/entities/api-key/api', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindProviders };
    }),
}));

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { setApiDefaultModelAction } from '@/entities/siglens-api-key/actions/setApiDefaultModelAction';
import type { SetApiDefaultModelState } from '@/entities/siglens-api-key/model';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const IDLE: SetApiDefaultModelState = { status: 'idle' };
const USER_ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: USER_ID } as never;

function providers(...names: string[]) {
    mockFindProviders.mockResolvedValue(
        names.map(provider => ({ provider, updatedAt: new Date() }))
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCurrentUser.mockResolvedValue(USER);
    mockSetModel.mockResolvedValue(true);
});

describe('setApiDefaultModelAction', () => {
    it('등록한 provider의 byok 모델을 본인 id로 저장한다', async () => {
        providers('anthropic');

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: 'claude-opus-5' })
        );

        expect(result).toEqual({ status: 'saved', model: 'claude-opus-5' });
        expect(mockFindProviders).toHaveBeenCalledWith(USER_ID);
        expect(mockSetModel).toHaveBeenCalledWith(USER_ID, 'claude-opus-5');
        expect(revalidatePath).toHaveBeenCalledWith(
            '/[locale]/account',
            'page'
        );
    });

    it('빈 값이면 설정을 해제(null)하고 키 조회도 하지 않는다', async () => {
        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: '  ' })
        );

        expect(result).toEqual({ status: 'saved', model: null });
        expect(mockSetModel).toHaveBeenCalledWith(USER_ID, null);
        expect(mockFindProviders).not.toHaveBeenCalled();
    });

    it('그 모델 provider의 키가 없으면 provider_key_missing이고 저장하지 않는다', async () => {
        providers('openai');

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: 'claude-opus-5' })
        );

        expect(result).toMatchObject({
            status: 'error',
            code: 'provider_key_missing',
        });
        expect(mockSetModel).not.toHaveBeenCalled();
    });

    it.each([
        ['로스터에 없는 ID', 'no-such-model'],
        ['프로토타입 키', 'constructor'],
        ['SQL 조각', "claude-opus-5'; DROP TABLE users;--"],
    ])('%s는 invalid_model이고 저장하지 않는다', async (_label, model) => {
        providers('anthropic', 'openai', 'google', 'deepseek');

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model })
        );

        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_model',
        });
        expect(mockSetModel).not.toHaveBeenCalled();
    });

    it.each([
        ['free 등급', 'claude-haiku-5-5'],
        ['member 등급', 'claude-sonnet-5-5'],
        ['byok 등급', 'claude-opus-5'],
    ])(
        '%s 모델도 그 provider의 키가 있으면 기본 모델로 저장된다(API는 모든 모델을 사용자 키로 생성한다)',
        async (_label, model) => {
            providers('anthropic');

            const result = await setApiDefaultModelAction(
                IDLE,
                makeFormData({ model })
            );

            expect(result).toEqual({ status: 'saved', model });
            expect(mockSetModel).toHaveBeenCalledWith(USER_ID, model);
        }
    );

    it('model 필드가 문자열이 아니면 invalid_model', async () => {
        const result = await setApiDefaultModelAction(IDLE, new FormData());
        expect(result).toMatchObject({ code: 'invalid_model' });
        expect(mockSetModel).not.toHaveBeenCalled();
    });

    it('비로그인은 unauthenticated이고 DB를 건드리지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: 'claude-opus-5' })
        );

        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockFindProviders).not.toHaveBeenCalled();
        expect(mockSetModel).not.toHaveBeenCalled();
    });

    it('다른 회원의 키를 보지 않는다 — 키 조회도 세션 회원 id로만 한다 (IDOR)', async () => {
        providers('anthropic');
        await setApiDefaultModelAction(
            IDLE,
            makeFormData({
                model: 'claude-opus-5',
                userId: '99999999-9999-4999-8999-999999999999',
            })
        );

        expect(mockFindProviders).toHaveBeenCalledWith(USER_ID);
        expect(mockSetModel).toHaveBeenCalledWith(USER_ID, 'claude-opus-5');
    });

    it('저장 대상 회원 행이 없으면 unauthenticated', async () => {
        providers('anthropic');
        mockSetModel.mockResolvedValue(false);

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: 'claude-opus-5' })
        );

        expect(result).toMatchObject({ code: 'unauthenticated' });
    });

    it('DB 오류는 던지지 않고 server_error로 돌려준다', async () => {
        mockFindProviders.mockRejectedValue(new Error('db down'));

        const result = await setApiDefaultModelAction(
            IDLE,
            makeFormData({ model: 'claude-opus-5' })
        );

        expect(result).toMatchObject({
            status: 'error',
            code: 'server_error',
        });
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
