const mockGetCurrentUser = jest.fn();
const mockGetUserTier = jest.fn();
const mockFindByUserAndProvider = jest.fn();

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

jest.mock('@/infrastructure/db/userRepository', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/infrastructure/tier/use-cases/getUserTier', () => ({
    getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
}));

jest.mock('@/infrastructure/db/userApiKeyRepository', () => {
    const actual = jest.requireActual(
        '@/infrastructure/db/userApiKeyRepository'
    );
    return {
        ...actual,
        DrizzleUserApiKeyRepository: jest.fn().mockImplementation(() => ({
            findByUserAndProvider: mockFindByUserAndProvider,
        })),
    };
});

import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { submitAnalysis } from '@y0ngha/siglens-core';
import type { ModelId, SubmitAnalysisGatedResult } from '@y0ngha/siglens-core';
import { LlmApiKeyDecryptionFailedError } from '@/infrastructure/db/userApiKeyRepository';

const mockSubmitAnalysis = submitAnalysis as jest.MockedFunction<
    typeof submitAnalysis
>;

const cachedResult: SubmitAnalysisGatedResult = {
    status: 'cached',
    result: { summary: 'cached' } as never,
};

const FREE_MODEL = 'gemini-2.5-flash-lite' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;
const UNKNOWN_MODEL = 'totally-not-a-model' as ModelId;

describe('submitAnalysisAction tier + BYOK gate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSubmitAnalysis.mockResolvedValue(cachedResult);
        mockGetCurrentUser.mockResolvedValue(null);
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockResolvedValue(null);
    });

    it('modelId 미지정 시 core submitAnalysis로 그대로 위임한다', async () => {
        await submitAnalysisAction('AAPL', '1Day', true, '^AAPL');
        expect(mockSubmitAnalysis).toHaveBeenCalledTimes(1);
        expect(mockGetUserTier).not.toHaveBeenCalled();
    });

    it('free tier + free model 게스트는 통과한다', async () => {
        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            FREE_MODEL
        );
        expect(result).toBe(cachedResult);
        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ modelId: FREE_MODEL })
        );
    });

    it('free tier + premium model + BYOK 미등록 게스트는 차단한다', async () => {
        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );
        expect(result).toEqual({
            status: 'error',
            error: expect.objectContaining({ code: 'tier_premium_blocked' }),
        });
        expect(mockSubmitAnalysis).not.toHaveBeenCalled();
    });

    it('free tier + premium model + BYOK 등록 시 통과하고 userApiKey가 core로 전달된다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockResolvedValue({
            apiKey: 'sk-ant-byok',
        });

        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        expect(result).toBe(cachedResult);
        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({
                modelId: PREMIUM_MODEL,
                userApiKey: 'sk-ant-byok',
            })
        );
    });

    it('paid tier (pro) + premium model 은 BYOK 없이도 통과한다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
        mockGetUserTier.mockResolvedValue('pro');
        mockFindByUserAndProvider.mockResolvedValue(null);

        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        expect(result).toBe(cachedResult);
        // userApiKey must be absent — without BYOK, core uses its server-side
        // paid key. Forwarding undefined/null/'' would all be wrong, so we
        // pin the exact options shape rather than a partial match.
        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        const opts = lastCall![4] as Record<string, unknown>;
        expect(opts.modelId).toBe(PREMIUM_MODEL);
        expect(opts).not.toHaveProperty('userApiKey');
    });

    it('알 수 없는 modelId는 invalid_model로 차단한다', async () => {
        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            UNKNOWN_MODEL
        );
        expect(result).toEqual({
            status: 'error',
            error: expect.objectContaining({ code: 'invalid_model' }),
        });
        expect(mockSubmitAnalysis).not.toHaveBeenCalled();
    });

    it('BYOK 복호화 실패 시 api_key_corrupted로 차단한다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockRejectedValue(
            new LlmApiKeyDecryptionFailedError('u1', 'anthropic')
        );

        const result = await submitAnalysisAction(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        expect(result).toEqual({
            status: 'error',
            error: expect.objectContaining({ code: 'api_key_corrupted' }),
        });
        expect(mockSubmitAnalysis).not.toHaveBeenCalled();
    });
});
