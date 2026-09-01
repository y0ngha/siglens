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
    /**
     * 회귀(감사 M5): `try`가 준비 문장 뒤에서 시작하던 시절, 여기서 던지면 거절이
     * 호출자의 `Promise.all`로 전파돼 **성공한 분석이 통째로 실패**했다.
     * `tryReadPlainModelConfig`는 미처리 provider에 대해 의도적으로 throw한다.
     */
    it('준비 단계에서 던져도 reject하지 않고 null로 떨어진다', async () => {
        tryReadPlainModelConfig.mockImplementation(() => {
            throw new Error('unhandled provider');
        });
        await expect(
            rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')
        ).resolves.toBeNull();
    });

    /**
     * 회귀(감사 M2): `dropSupersededPaths` 호출부가 테스트로 고정돼 있지 않았다.
     * 이 경로가 빠지면 보정 전/후 매매 가격 두 벌이 함께 프롬프트에 실려,
     * "다른 분석에서는 목표가를…" 같은 모순 출력이 돌아온다.
     */
    it('대체된 경로를 프롬프트에서 실제로 뺀다', async () => {
        const withReconciled = {
            summary: '요약'.repeat(60),
            actionRecommendation: {
                entry: '진입 문구'.repeat(10),
                exit: '원본 청산 196.53달러',
                riskReward: '원본 손익비 3.2',
                reconciledLevels: {
                    exit: '보정 청산 190달러',
                    riskReward: '보정 손익비 2.1',
                    reason: '보정 사유 문구',
                },
            },
        };
        await rewriteToPlainLanguage(withReconciled, 'AAPL', 'ko');

        const prompt = callAiProviderRouter.mock.calls[0][0].contents;
        expect(prompt).toContain('보정 청산 190달러');
        expect(prompt).not.toContain('원본 청산 196.53달러');
        expect(prompt).not.toContain('원본 손익비 3.2');
        expect(prompt).not.toContain('보정 사유 문구');
    });

    /** 회귀(감사): ja 로케일에서 `319.70달러` 같은 혼합 표기가 나가던 자리. */
    it('통화 표기가 출력 언어를 따른다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ja', 'USD');
        expect(callAiProviderRouter.mock.calls[0][0].contents).toContain(
            'ドル'
        );

        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        cacheGet.mockResolvedValue(null);
        createCacheProvider.mockReturnValue({ get: cacheGet, set: cacheSet });
        tryReadPlainModelConfig.mockReturnValue({
            serverApiKey: 'k',
            model: 'deepseek-v4-flash',
        });
        callAiProviderRouter.mockResolvedValue(GOOD);

        await rewriteToPlainLanguage(ANALYSIS, '005930.KS', 'ko', 'KRW');
        expect(callAiProviderRouter.mock.calls[0][0].contents).toContain('원');
    });

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

    /**
     * 재시도까지 실패해도 어긋난 **문장만** 도려내 살린다. 전체 폐기는 최후 수단이다 —
     * 위반은 대개 문장 한두 개에 몰려 있고, 문단 일부를 잃는 것이 쉽게보기가 통째로
     * 사라지는 것보다 낫다.
     */
    it('재시도도 실패하면 어긋난 문장을 도려내고 살린다', async () => {
        callAiProviderRouter.mockResolvedValue(
            `${GOOD}\n\n목표가 999.99달러입니다.`
        );

        const result = await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        expect(result).not.toBeNull();
        expect(result).not.toContain('999.99');
        expect(result).toContain('좋은 문장입니다');
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
        // 살려낸 결과도 캐시에 넣는다 — 다음 조회가 같은 왕복을 반복하지 않는다.
        expect(cacheSet).toHaveBeenCalledOnce();
    });

    /** 도려내도 길이 하한을 못 넘으면 그때는 정말 버린다. */
    it('도려낸 결과가 너무 짧으면 null', async () => {
        callAiProviderRouter.mockResolvedValue('목표가 999.99달러입니다.');
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(cacheSet).not.toHaveBeenCalled();
    });

    /** 크기 접미사는 자릿수가 틀린 금액이라 문장 제거로 고쳐지지 않는다. */
    it('크기 접미사 실패는 살리지 않는다', async () => {
        callAiProviderRouter.mockResolvedValue(
            `${GOOD}\n\n총부채는 3,475.2B 원입니다.`
        );
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
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
