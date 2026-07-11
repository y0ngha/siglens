import type { MockedFunction } from 'vitest';

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(),
}));

// E2E 쿠키 seam 분기 테스트용 — 액션이 동적 import하는 stub을 결정적 mock으로 대체.
vi.mock('@/shared/api/e2eAnalysisStub', () => ({
    // Mirrors E2E_FORCE_ANALYSIS_ERROR_COOKIE in @/shared/api/e2eAnalysisStub.
    // vi.mock factories are hoisted above imports, so the constant can't be
    // imported here — keep this literal in sync if the source value changes.
    E2E_FORCE_ANALYSIS_ERROR_COOKIE: 'e2e_force_analysis_error',
    e2eForcedOptionsError: vi.fn(() => ({
        status: 'no_chains_error',
        code: 'no_options_chains',
        error: 'E2E 강제 분석 실패 (resilience 테스트용)',
    })),
    e2eCachedOptions: vi.fn(() => ({ status: 'cached', result: {} })),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitOptionsAnalysis: vi.fn(),
    pollOptionsAnalysis: vi.fn(),
    cancelJob: vi.fn(),
}));

vi.mock('../lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
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

import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
    cancelJob,
    type ModelId,
    type SubmitOptionsAnalysisResult,
    type OptionsSnapshot,
    type OptionsChain,
} from '@y0ngha/siglens-core';
import { cookies } from 'next/headers';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
    cancelOptionsAnalysisJobAction,
} from '../actions/optionsActions';

const mockSubmitOptionsAnalysis = submitOptionsAnalysis as MockedFunction<
    typeof submitOptionsAnalysis
>;
const mockPollOptionsAnalysis = pollOptionsAnalysis as MockedFunction<
    typeof pollOptionsAnalysis
>;
const mockFetchOptionsSnapshot = fetchOptionsSnapshot as MockedFunction<
    typeof fetchOptionsSnapshot
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockCancelJob = cancelJob as MockedFunction<typeof cancelJob>;
const mockCookies = cookies as MockedFunction<typeof cookies>;

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

const MOCK_CHAIN: OptionsChain = {
    expirationDate: '2026-06-20',
    daysToExpiration: 37,
    calls: [],
    puts: [],
};

const MOCK_SNAPSHOT: OptionsSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 192.5,
    capturedAt: '2026-05-14T00:00:00Z',
    chains: [MOCK_CHAIN],
};

const SUBMITTED_RESULT: SubmitOptionsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-options-001',
};

describe('submitOptionsAnalysisAction', () => {
    beforeEach(() => {
        mockSubmitOptionsAnalysis.mockReset();
        mockFetchOptionsSnapshot.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockFetchOptionsSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
        mockSubmitOptionsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    it('forwards symbol, companyName, expirationDate, and modelId to siglens-core', async () => {
        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                expirationDate: 'all',
                modelId: MODEL_ID,
                snapshot: MOCK_SNAPSHOT,
            })
        );
    });

    it('returns no_options_chains error when snapshot is null', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'no_chains_error',
            code: 'no_options_chains',
        });
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '2026-06-20',
            MODEL_ID
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ tier: 'member' })
        );
    });

    it('forwards userApiKey when present in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
            userApiKey: 'usr-key',
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            PREMIUM_MODEL
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        const callArg = mockSubmitOptionsAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });

    describe('reasoning forwarding', () => {
        it('forwards reasoning: true for member tier when client requests it', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await submitOptionsAnalysisAction(
                'AAPL',
                'Apple Inc.',
                'all',
                MODEL_ID,
                true
            );

            expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('forces reasoning: false for free tier even when client requests true', async () => {
            await submitOptionsAnalysisAction(
                'AAPL',
                'Apple Inc.',
                'all',
                MODEL_ID,
                true
            );

            expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false when omitted', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await submitOptionsAnalysisAction(
                'AAPL',
                'Apple Inc.',
                'all',
                MODEL_ID
            );

            expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });
    });
});

describe('pollOptionsAnalysisAction', () => {
    it('delegates to pollOptionsAnalysis and returns result', async () => {
        const polledResult = { status: 'processing' as const };
        mockPollOptionsAnalysis.mockResolvedValueOnce(polledResult);

        const result = await pollOptionsAnalysisAction('job-001');

        expect(mockPollOptionsAnalysis).toHaveBeenCalledWith('job-001');
        expect(result).toBe(polledResult);
    });

    it('returns unexpected_error and logs when pollOptionsAnalysis throws', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const pollError = new Error('queue down');
        mockPollOptionsAnalysis.mockRejectedValueOnce(pollError);

        const result = await pollOptionsAnalysisAction('job-err');

        expect(result).toEqual({
            status: 'error',
            error: 'unexpected_error',
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[pollOptionsAnalysisAction] poll failed:',
            'job-err',
            pollError
        );

        consoleErrorSpy.mockRestore();
    });
});

describe('cancelOptionsAnalysisJobAction', () => {
    beforeEach(() => {
        mockCancelJob.mockReset();
    });

    it('delegates to cancelJob and resolves to undefined on success', async () => {
        mockCancelJob.mockResolvedValueOnce(undefined);

        const result = await cancelOptionsAnalysisJobAction('job-cancel-001');

        expect(mockCancelJob).toHaveBeenCalledWith('job-cancel-001');
        expect(result).toBeUndefined();
    });

    it('swallows errors and logs a warning when cancelJob rejects', async () => {
        const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        const cancelError = new Error('worker unreachable');
        mockCancelJob.mockRejectedValueOnce(cancelError);

        await expect(
            cancelOptionsAnalysisJobAction('job-cancel-err')
        ).resolves.toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[cancelOptionsAnalysisJobAction] 취소 신호 전송 실패:',
            'job-cancel-err',
            cancelError
        );

        consoleWarnSpy.mockRestore();
    });
});

describe('submitOptionsAnalysisAction — E2E force-error cookie seam', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        mockCookies.mockReset();
        // 누적 call count를 초기화 — not.toHaveBeenCalled()가 외부 describe의
        // 테스트 실행 순서에 묵시적으로 의존하지 않도록 한다(resetMocks 미설정).
        mockSubmitOptionsAnalysis.mockReset();
        process.env.E2E_TEST = '1';
    });

    afterEach(() => {
        if (originalE2E === undefined) {
            delete process.env.E2E_TEST;
        } else {
            process.env.E2E_TEST = originalE2E;
        }
    });

    it('returns the forced error result when the force-error cookie is present', async () => {
        // 액션은 .get(name)의 truthy 여부만 보므로 value만 있으면 충분하다.
        mockCookies.mockResolvedValue({
            get: vi.fn(() => ({ value: '1' })),
        } as never);

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result.status).toBe('no_chains_error');
        // 강제 에러 경로는 core 제출을 건드리지 않는다.
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('returns the cached fixture when the force-error cookie is absent', async () => {
        mockCookies.mockResolvedValue({
            get: vi.fn(() => undefined),
        } as never);

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result.status).toBe('cached');
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });
});
