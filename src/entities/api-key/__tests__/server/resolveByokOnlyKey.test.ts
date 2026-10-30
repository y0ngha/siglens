const { mockFind, mockGetDb } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockGetDb: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: mockGetDb }));
vi.mock('@/entities/api-key/api', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/api-key/api')>()),
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findByUserAndProvider: mockFind };
    }),
}));
// 서버 키 env 접근 자체를 감시한다 — 이 경로는 `getServerPrimaryKey`를 부르면 안 된다.
vi.mock('@/entities/llm-provider/api/serverKeys', () => ({
    getServerPrimaryKey: vi.fn(() => 'SERVER-KEY-MUST-NOT-BE-USED'),
}));

import { LlmApiKeyDecryptionFailedError } from '@/entities/api-key/api';
import { resolveByokOnlyKey } from '@/entities/api-key/server/resolveByokOnlyKey';
import { getServerPrimaryKey } from '@/entities/llm-provider/api/serverKeys';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SERVER_ENV_NAMES = [
    'GEMINI_CHAT_API_KEY',
    'ANTHROPIC_CHAT_API_KEY',
    'OPENAI_CHAT_API_KEY',
    'DEEPSEEK_CHAT_API_KEY',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'DEEPSEEK_API_KEY',
];

beforeEach(() => {
    vi.clearAllMocks();
    // 서버 키가 환경에 있어도 쓰이지 않음을 보이기 위해 전부 채운다.
    SERVER_ENV_NAMES.forEach(name => vi.stubEnv(name, `server-${name}`));
});
afterEach(() => vi.unstubAllEnvs());

describe('resolveByokOnlyKey', () => {
    it('그 모델 provider의 사용자 키를 userId로 조회해 돌려준다', async () => {
        mockFind.mockResolvedValue({ apiKey: 'sk-user-anthropic' });

        await expect(
            resolveByokOnlyKey(USER_ID, 'claude-opus-5')
        ).resolves.toEqual({
            status: 'ok',
            provider: 'anthropic',
            apiKey: 'sk-user-anthropic',
        });
        expect(mockFind).toHaveBeenCalledWith(USER_ID, 'anthropic');
    });

    it.each([
        ['claude-opus-5', 'anthropic'],
        ['gpt-6-astra', 'openai'],
        ['gemini-4-argon', 'google'],
    ])('%s는 %s 키를 조회한다', async (modelId, provider) => {
        mockFind.mockResolvedValue({ apiKey: 'k' });
        await resolveByokOnlyKey(USER_ID, modelId as 'claude-opus-5');
        expect(mockFind).toHaveBeenCalledWith(USER_ID, provider);
    });

    it('등록된 키가 없으면 서버 키 env가 모두 있어도 byok_key_required를 돌려준다', async () => {
        mockFind.mockResolvedValue(null);

        const result = await resolveByokOnlyKey(USER_ID, 'claude-opus-5');

        expect(result).toEqual({
            status: 'byok_key_required',
            provider: 'anthropic',
            reason: 'not_registered',
        });
        expect(JSON.stringify(result)).not.toContain('server-');
        expect(getServerPrimaryKey).not.toHaveBeenCalled();
    });

    it('복호화에 실패한 키는 서버 키로 넘어가지 않고 다시 등록하도록 byok_key_required(unreadable)', async () => {
        mockFind.mockRejectedValue(
            new LlmApiKeyDecryptionFailedError(USER_ID, 'anthropic')
        );

        await expect(
            resolveByokOnlyKey(USER_ID, 'claude-opus-5')
        ).resolves.toEqual({
            status: 'byok_key_required',
            provider: 'anthropic',
            reason: 'unreadable',
        });
        expect(getServerPrimaryKey).not.toHaveBeenCalled();
    });

    it('DB 오류는 키 없음으로 삼키지 않고 던진다', async () => {
        mockFind.mockRejectedValue(new Error('connection refused'));

        await expect(
            resolveByokOnlyKey(USER_ID, 'claude-opus-5')
        ).rejects.toThrow('connection refused');
    });

    it('다른 회원의 키가 저장소에 있어도 요청한 userId로만 조회한다 (IDOR)', async () => {
        const OTHER_USER = '22222222-2222-4222-8222-222222222222';
        mockFind.mockImplementation(async (userId: string) =>
            userId === OTHER_USER ? { apiKey: 'sk-OTHER-USERS-KEY' } : null
        );

        const result = await resolveByokOnlyKey(USER_ID, 'claude-opus-5');

        expect(result.status).toBe('byok_key_required');
        expect(mockFind).toHaveBeenCalledTimes(1);
        expect(mockFind).toHaveBeenCalledWith(USER_ID, 'anthropic');
    });
});
