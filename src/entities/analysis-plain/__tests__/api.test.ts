import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAiProviderRouter = vi.fn();
const cacheGet = vi.fn();
const cacheSet = vi.fn();
const createCacheProvider = vi.fn();
const tryReadPlainModelConfig = vi.fn();
const isE2E = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/entities/llm-provider', () => ({
    callAiProviderRouter: (...args: unknown[]) => callAiProviderRouter(...args),
    stripMarkdownCodeBlock: (raw: string) =>
        raw.replace(/^```[a-z]*\s*|```\s*$/g, ''),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: () => createCacheProvider(),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));
vi.mock('../lib/plainModel', () => ({
    tryReadPlainModelConfig: () => tryReadPlainModelConfig(),
}));

const { rewriteToPlainLanguage } = await import('../api');

/** 산문 두 조각. 길이 하한(200자, 입력의 20%)을 넘는 출력만 통과한다. */
const ANALYSIS = {
    summary: '요약'.repeat(60),
    keyLevels: { support: [{ price: 183.6, reason: '지지 근거'.repeat(20) }] },
};
const GOOD = `${'좋은 문장입니다. '.repeat(30)}\n\n지지선은 183.60달러입니다.`;

beforeEach(() => {
    vi.clearAllMocks();
    isE2E.mockReturnValue(false);
    tryReadPlainModelConfig.mockReturnValue({
        serverApiKey: 'k',
        model: 'deepseek-v4-flash',
    });
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);
    createCacheProvider.mockReturnValue({ get: cacheGet, set: cacheSet });
    callAiProviderRouter.mockResolvedValue(GOOD);
});

describe('rewriteToPlainLanguage', () => {
    it('E2E에서는 LLM을 태우지 않는다', async () => {
        isE2E.mockReturnValue(true);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(callAiProviderRouter).not.toHaveBeenCalled();
    });

    it('산문이 없으면 호출하지 않고 null', async () => {
        expect(await rewriteToPlainLanguage({}, 'AAPL', 'ko')).toBeNull();
        expect(callAiProviderRouter).not.toHaveBeenCalled();
    });

    it('모델 설정이 없으면 호출하지 않고 null', async () => {
        tryReadPlainModelConfig.mockReturnValue(null);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(callAiProviderRouter).not.toHaveBeenCalled();
    });

    it('캐시 히트면 LLM을 부르지 않는다', async () => {
        cacheGet.mockResolvedValue(GOOD);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(GOOD);
        expect(callAiProviderRouter).not.toHaveBeenCalled();
    });

    it('통과하면 텍스트를 돌려주고 캐시에 쓴다', async () => {
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(cacheSet).toHaveBeenCalledOnce();
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
    });

    it('가드가 걸리면 지적을 덧붙여 한 번만 재시도한다', async () => {
        callAiProviderRouter
            .mockResolvedValueOnce(`${GOOD} 목표가 999.99달러`)
            .mockResolvedValueOnce(GOOD);

        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
        const retryPrompt = callAiProviderRouter.mock.calls[1][0].contents;
        expect(retryPrompt).toContain('999.99');
    });

    it('재시도도 실패하면 null이고 캐시에 쓰지 않는다', async () => {
        callAiProviderRouter.mockResolvedValue(`${GOOD} 목표가 999.99달러`);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
        expect(cacheSet).not.toHaveBeenCalled();
    });

    it('LLM이 던져도 예외를 전파하지 않는다 — 분석 전체가 실패하면 안 된다', async () => {
        callAiProviderRouter.mockRejectedValue(new Error('provider down'));
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
    });

    it('캐시 팩토리가 던져도 예외를 전파하지 않는다', async () => {
        createCacheProvider.mockImplementation(() => {
            throw new Error('no redis');
        });
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
    });

    it('캐시가 없어도(로컬·E2E) 동작한다', async () => {
        createCacheProvider.mockReturnValue(null);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
    });

    it('텔레메트리 분리를 위해 jobId를 지정한다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
        expect(callAiProviderRouter.mock.calls[0][0].jobId).toBe(
            'analysis-plain'
        );
    });

    it('로케일이 캐시 키를 가른다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
        const koKey = cacheGet.mock.calls[0][0];
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        cacheGet.mockResolvedValue(null);
        createCacheProvider.mockReturnValue({ get: cacheGet, set: cacheSet });
        tryReadPlainModelConfig.mockReturnValue({
            serverApiKey: 'k',
            model: 'deepseek-v4-flash',
        });
        callAiProviderRouter.mockResolvedValue(GOOD);
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ja');
        expect(cacheGet.mock.calls[0][0]).not.toBe(koKey);
    });
});
