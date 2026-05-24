jest.mock('server-only', () => ({}), { virtual: true });

const mockGetUserTier = jest.fn();
const mockFindByUserAndProvider = jest.fn();

jest.mock('@/shared/db/client', () => ({
    getDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

jest.mock('@/entities/user', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/infrastructure/tier/use-cases/getUserTier', () => ({
    getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
}));

jest.mock('@/entities/api-key', () => {
    const actual = jest.requireActual('@/entities/api-key');
    return {
        ...actual,
        DrizzleUserApiKeyRepository: jest.fn().mockImplementation(() => ({
            findByUserAndProvider: mockFindByUserAndProvider,
        })),
    };
});

import { LlmApiKeyDecryptionFailedError } from '@/entities/api-key';
import {
    resolveTierAndByok,
    buildGateError,
    isKnownModelId,
} from '../lib/byokGate';
import type { ModelId } from '@y0ngha/siglens-core';

const FREE_MODEL = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;
const UNKNOWN_MODEL = 'totally-not-a-model' as ModelId;

describe('resolveTierAndByok', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockResolvedValue(null);
    });

    it('returns blocked invalid_model for unknown modelId', async () => {
        const result = await resolveTierAndByok(null, UNKNOWN_MODEL);
        expect(result).toEqual({
            kind: 'blocked',
            error: expect.objectContaining({ code: 'invalid_model' }),
        });
        expect(mockGetUserTier).not.toHaveBeenCalled();
        expect(mockFindByUserAndProvider).not.toHaveBeenCalled();
    });

    it('returns allowed with tier=free when userId is null and model is free', async () => {
        const result = await resolveTierAndByok(null, FREE_MODEL);
        expect(result).toEqual({ kind: 'allowed', tier: 'free' });
        expect(mockGetUserTier).not.toHaveBeenCalled();
        expect(mockFindByUserAndProvider).not.toHaveBeenCalled();
    });

    it('returns blocked tier_premium_blocked when userId is null and model is premium', async () => {
        const result = await resolveTierAndByok(null, PREMIUM_MODEL);
        expect(result).toEqual({
            kind: 'blocked',
            error: expect.objectContaining({ code: 'tier_premium_blocked' }),
        });
        expect(mockFindByUserAndProvider).not.toHaveBeenCalled();
    });

    it('returns allowed without userApiKey for pro tier on premium model', async () => {
        mockGetUserTier.mockResolvedValue('pro');
        const result = await resolveTierAndByok('u1', PREMIUM_MODEL);
        expect(result).toEqual({ kind: 'allowed', tier: 'pro' });
        expect(mockFindByUserAndProvider).not.toHaveBeenCalled();
    });

    it('returns allowed without userApiKey for non-pro tier on free model', async () => {
        mockGetUserTier.mockResolvedValue('member');
        const result = await resolveTierAndByok('u1', FREE_MODEL);
        expect(result).toEqual({ kind: 'allowed', tier: 'member' });
        expect(mockFindByUserAndProvider).not.toHaveBeenCalled();
    });

    it('returns allowed with userApiKey for non-pro premium with BYOK record', async () => {
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockResolvedValue({ apiKey: 'sk-ant-byok' });
        const result = await resolveTierAndByok('u1', PREMIUM_MODEL);
        expect(result).toEqual({
            kind: 'allowed',
            tier: 'free',
            userApiKey: 'sk-ant-byok',
        });
    });

    it('returns blocked tier_premium_blocked for non-pro premium without BYOK record', async () => {
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockResolvedValue(null);
        const result = await resolveTierAndByok('u1', PREMIUM_MODEL);
        expect(result).toEqual({
            kind: 'blocked',
            error: expect.objectContaining({ code: 'tier_premium_blocked' }),
        });
    });

    it('returns blocked api_key_corrupted on LlmApiKeyDecryptionFailedError', async () => {
        mockGetUserTier.mockResolvedValue('free');
        mockFindByUserAndProvider.mockRejectedValue(
            new LlmApiKeyDecryptionFailedError('u1', 'anthropic')
        );
        const result = await resolveTierAndByok('u1', PREMIUM_MODEL);
        expect(result).toEqual({
            kind: 'blocked',
            error: expect.objectContaining({ code: 'api_key_corrupted' }),
        });
    });

    it('rethrows unexpected non-decryption errors', async () => {
        mockGetUserTier.mockResolvedValue('free');
        const boom = new Error('db connection failed');
        mockFindByUserAndProvider.mockRejectedValue(boom);
        await expect(resolveTierAndByok('u1', PREMIUM_MODEL)).rejects.toThrow(
            boom
        );
    });

    it('rethrows getUserTier errors', async () => {
        const boom = new Error('db tier lookup failed');
        mockGetUserTier.mockRejectedValue(boom);
        await expect(resolveTierAndByok('u1', FREE_MODEL)).rejects.toThrow(
            boom
        );
    });
});

describe('buildGateError', () => {
    it('returns error with correct code and message', () => {
        const err = buildGateError('invalid_model');
        expect(err.code).toBe('invalid_model');
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
    });
});

describe('isKnownModelId', () => {
    it('returns true for a known free model', () => {
        expect(isKnownModelId('gemini-2.5-flash')).toBe(true);
    });

    it('returns true for a known premium model', () => {
        expect(isKnownModelId('claude-opus-4-7')).toBe(true);
    });

    it('returns false for an unknown model', () => {
        expect(isKnownModelId('totally-not-a-model')).toBe(false);
    });
});
