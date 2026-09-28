vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/api/e2eEnv', () => ({
    isE2E: vi.fn(() => false),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { isE2E } from '@/shared/api/e2eEnv';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import { runGatedAnalysis } from '@/entities/analysis/lib/runGatedAnalysis';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockIsE2E = isE2E as MockedFunction<typeof isE2E>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;

type Result = { status: 'cached'; from: string };

function params(overrides: {
    reasoning?: boolean;
    submit?: () => Promise<Result>;
}) {
    return {
        actionName: 'testAction',
        modelId: 'gemini-3.6-flash' as const,
        locale: 'ko' as const,
        reasoning: overrides.reasoning,
        e2eResult: vi.fn(async (): Promise<Result> => ({
            status: 'cached',
            from: 'e2e',
        })),
        submit: vi.fn(
            overrides.submit ??
                (async (): Promise<Result> => ({
                    status: 'cached',
                    from: 'core',
                }))
        ),
    };
}

describe('runGatedAnalysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsE2E.mockReturnValue(false);
        mockGetCurrentUser.mockResolvedValue(null);
    });

    it('returns the E2E fixture without touching the user or the gate', async () => {
        mockIsE2E.mockReturnValue(true);
        const p = params({});

        await expect(runGatedAnalysis(p)).resolves.toEqual({
            status: 'cached',
            from: 'e2e',
        });
        expect(mockGetCurrentUser).not.toHaveBeenCalled();
        expect(p.submit).not.toHaveBeenCalled();
    });

    it('returns the gate error when the gate blocks', async () => {
        const error = { code: 'tier_premium_blocked' as const, message: 'no' };
        mockResolveTierAndByok.mockResolvedValue({ kind: 'blocked', error });
        const p = params({});

        await expect(runGatedAnalysis(p)).resolves.toEqual({
            status: 'error',
            error,
        });
        expect(p.submit).not.toHaveBeenCalled();
    });

    it('forwards tier, tier-gated reasoning, bot parity and the BYOK key to submit', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as Awaited<
            ReturnType<typeof getCurrentUser>
        >);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro',
            userApiKey: 'sk-user',
        });
        const p = params({ reasoning: true });

        await runGatedAnalysis(p);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(
            'u1',
            'gemini-3.6-flash',
            'ko'
        );
        expect(p.submit).toHaveBeenCalledWith({
            tier: 'pro',
            reasoning: true,
            skipEnqueueIfMiss: false,
            userApiKey: 'sk-user',
        });
    });

    it('omits userApiKey and forces reasoning off for a free caller', async () => {
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free',
        });
        const p = params({ reasoning: true });

        await runGatedAnalysis(p);

        expect(p.submit).toHaveBeenCalledWith({
            tier: 'free',
            reasoning: false,
            skipEnqueueIfMiss: false,
        });
    });

    it('maps an unexpected throw to a localized gate error instead of rethrowing', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free',
        });
        const p = params({
            submit: () => Promise.reject(new Error('boom')),
        });

        const result = await runGatedAnalysis(p);

        expect(result).toMatchObject({
            status: 'error',
            error: { code: 'unexpected_error' },
        });
        expect(spy).toHaveBeenCalledWith(
            '[testAction] unexpected error:',
            expect.any(Error)
        );
        spy.mockRestore();
    });
});
