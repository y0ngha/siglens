vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runOptionsAnalysis: vi.fn(),
}));
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { runOptionsAnalysis, type ModelId } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { fetchOptionsSnapshot } from '@/entities/options-chain/lib/optionsDataCache';
import { executeOptionsAnalysis } from '@/entities/options-chain/server/optionsAnalysisRunner';
import {
    ByokOnlyRoutingError,
    CACHE_PROBE_KEY_PLACEHOLDER,
} from '@/shared/lib/byokOnly';

const mockRun = vi.mocked(runOptionsAnalysis);
const mockFetch = vi.mocked(fetchOptionsSnapshot);
const BYOK_MODEL = 'gpt-6-astra' as ModelId;
const FREE_MODEL = 'gemini-3.6-flash' as ModelId;
const SNAPSHOT = {
    symbol: 'AAPL',
    underlyingPrice: 150,
    capturedAt: '2026-05-22T13:30:00Z',
    chains: [],
};
const base = {
    symbol: 'AAPL',
    companyName: 'Apple',
    expirationDate: 'all' as const,
    locale: 'en' as const,
    cacheOnly: false,
};
const byokCaller = {
    userId: 'u1',
    tier: 'member' as const,
    userApiKey: 'sk-user',
    byokOnly: true,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(SNAPSHOT as never);
    mockRun.mockResolvedValue({ status: 'done', result: {} } as never);
});

describe('executeOptionsAnalysis', () => {
    it('호출자의 tier·userApiKey를 core에 넘기고 세션 쿠키는 읽지 않는다', async () => {
        await executeOptionsAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });
        expect(mockRun).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'member',
                userApiKey: 'sk-user',
                modelId: BYOK_MODEL,
                expirationDate: 'all',
                skipEnqueueIfMiss: false,
            })
        );
        expect(getCurrentUser).not.toHaveBeenCalled();
    });

    it('cacheOnly는 skipEnqueueIfMiss로 전달된다', async () => {
        await executeOptionsAnalysis({
            ...base,
            caller: { ...byokCaller, userApiKey: CACHE_PROBE_KEY_PLACEHOLDER },
            modelId: BYOK_MODEL,
            cacheOnly: true,
        });
        expect(mockRun).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('스냅샷이 없으면 no_chains_error를 돌려준다(core를 부르지 않는다)', async () => {
        mockFetch.mockResolvedValue(null);
        await expect(
            executeOptionsAnalysis({
                ...base,
                caller: byokCaller,
                modelId: BYOK_MODEL,
            })
        ).resolves.toMatchObject({
            status: 'no_chains_error',
            code: 'no_options_chains',
        });
        expect(mockRun).not.toHaveBeenCalled();
    });

    it.each([
        ['pro tier', { ...byokCaller, tier: 'pro' as const }, BYOK_MODEL],
        ['free 등급 모델', byokCaller, FREE_MODEL],
        [
            '키 없음',
            { userId: 'u1', tier: 'member' as const, byokOnly: true },
            BYOK_MODEL,
        ],
    ])(
        'byokOnly에서 %s은 core를 부르기 전에 거절한다',
        async (_l, caller, modelId) => {
            await expect(
                executeOptionsAnalysis({ ...base, caller, modelId })
            ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockRun).not.toHaveBeenCalled();
        }
    );

    it('쿠키 액션 호출자(byokOnly 아님)는 검사를 받지 않는다', async () => {
        await executeOptionsAnalysis({
            ...base,
            caller: { userId: 'u1', tier: 'pro' },
            modelId: FREE_MODEL,
        });
        expect(mockRun.mock.calls[0][0]).not.toHaveProperty('userApiKey');
    });
});
