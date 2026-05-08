import type { AnalysisGateError } from '@/infrastructure/market/byokGate';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitFundamentalAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('@/infrastructure/market/byokGate', () => ({
    resolveTierAndByok: jest.fn(),
    buildGateError: jest.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

// ---------------------------------------------------------------------------
// Typed mocks & fixtures
// ---------------------------------------------------------------------------

import { submitFundamentalAnalysis } from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok } from '@/infrastructure/market/byokGate';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import type {
    ModelId,
    SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';

const mockSubmitFundamentalAnalysis =
    submitFundamentalAnalysis as jest.MockedFunction<
        typeof submitFundamentalAnalysis
    >;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as jest.MockedFunction<
    typeof resolveTierAndByok
>;

const CACHED_RESULT: SubmitFundamentalAnalysisResult = {
    status: 'cached',
    result: { categories: [] } as never,
};

const SUBMITTED_RESULT: SubmitFundamentalAnalysisResult = {
    status: 'submitted',
    jobId: 'job-fundamental-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitFundamentalAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockSubmitFundamentalAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockSubmitFundamentalAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    it('siglens-core submitFundamentalAnalysis에 symbol과 modelId를 전달한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
            })
        );
    });

    it('FmpFundamentalClient 인스턴스를 dataProvider로 전달한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFundamentalAnalysisAction('TSLA', MODEL_ID);

        const call = mockSubmitFundamentalAnalysis.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(FmpFundamentalClient).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        const result = await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 submitted 결과를 그대로 반환한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(SUBMITTED_RESULT);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitFundamentalAnalysisAction(
            'AAPL',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        // Gate fires before expensive provider fetch
        expect(mockSubmitFundamentalAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier="member" to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
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

        await submitFundamentalAnalysisAction('AAPL', PREMIUM_MODEL);

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
            // no userApiKey
        });

        await submitFundamentalAnalysisAction('AAPL', PREMIUM_MODEL);

        const callArg = mockSubmitFundamentalAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitFundamentalAnalysisAction('AAPL', MODEL_ID);

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });
});
