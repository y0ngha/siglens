import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callAiProviderRouter = vi.fn();
const repoFind = vi.fn();
const repoInsert = vi.fn();
const tryGetDatabaseClient = vi.fn();
const tryReadPlainModelConfig = vi.fn();
const isE2E = vi.fn();
const isOfflineBuild = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/entities/llm-provider/api/router', () => ({
    callAiProviderRouter: (...args: unknown[]) => callAiProviderRouter(...args),
}));
vi.mock('@/entities/llm-provider/lib/parseJsonResponse', () => ({
    stripMarkdownCodeBlock: (raw: string) =>
        raw.replace(/^```[a-z]*\s*|```\s*$/g, ''),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: () => isOfflineBuild(),
}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => tryGetDatabaseClient(),
}));
vi.mock('../plainTextRepository', () => ({
    DrizzlePlainTextRepository: class {
        find = (...args: unknown[]) => repoFind(...args);
        insert = (...args: unknown[]) => repoInsert(...args);
    },
}));
vi.mock('../lib/plainModel', () => ({
    tryReadPlainModelConfig: () => tryReadPlainModelConfig(),
}));

const { rewriteToPlainLanguage, PLAIN_STORE_READ_TIMEOUT_MS } =
    await import('../api');
const { PLAIN_PROMPT_VERSION } = await import('../lib/buildPlainPrompt');

/**
 * 산문 두 조각. 재작성에 길이 하한은 없다 — 쉽게보기는 항상 원본보기 토글과
 * 함께 노출되므로, 짧아도 숫자·문자 가드만 통과하면 그대로 쓴다.
 */
const ANALYSIS = {
    summary: '요약'.repeat(60),
    keyLevels: { support: [{ price: 183.6, reason: '지지 근거'.repeat(20) }] },
};
const GOOD = `${'좋은 문장입니다. '.repeat(30)}\n\n지지선은 183.60달러입니다.`;
/**
 * 근거 없는 숫자 문장이 원문의 25%를 넘게 차지하는 꼬리 — 재시도 전 도려내기
 * (`SALVAGE_BEFORE_RETRY_MAX_LOSS`)로는 너무 많이 잃어 재생성 경로를 타게 한다.
 */
const LARGE_BAD_TAIL = `\n\n${'목표가는 999.99달러입니다. '.repeat(8)}`;

/**
 * 호출 기록은 인덱스가 아니라 판별 인자로 찾는다 — 앞선 비동기 호출이 먼저
 * 도착해 `calls[0]`을 차지해도 단언이 흔들리지 않게.
 */
const findCallFor = (locale: string) =>
    repoFind.mock.calls.find(call => call[1] === locale);
const insertCallFor = (text: string) =>
    repoInsert.mock.calls.find(call => call[3] === text);

/**
 * `vi.spyOn(console, ...)`는 테스트 본문 끝에서 `mockRestore()`하면 앞선 `expect`가 실패했을 때
 * 복원되지 않고 다음 테스트로 새어 나간다. 여기서 한 번에 복원한다(`vi.fn()` 목은 건드리지 않는다).
 */
afterEach(() => {
    vi.restoreAllMocks();
});

beforeEach(() => {
    vi.clearAllMocks();
    isE2E.mockReturnValue(false);
    isOfflineBuild.mockReturnValue(false);
    tryReadPlainModelConfig.mockReturnValue({
        serverApiKey: 'k',
        model: 'deepseek-v4.1-flash',
    });
    repoFind.mockResolvedValue(null);
    repoInsert.mockResolvedValue(undefined);
    tryGetDatabaseClient.mockReturnValue({ db: {} });
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
        repoFind.mockResolvedValue(null);
        repoInsert.mockResolvedValue(undefined);
        tryGetDatabaseClient.mockReturnValue({ db: {} });
        tryReadPlainModelConfig.mockReturnValue({
            serverApiKey: 'k',
            model: 'deepseek-v4.1-flash',
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

    it('저장된 행이 있으면 LLM을 부르지 않고 그 텍스트를 돌려준다', async () => {
        repoFind.mockResolvedValue(GOOD);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(GOOD);
        expect(callAiProviderRouter).not.toHaveBeenCalled();
        expect(repoInsert).not.toHaveBeenCalled();
    });

    it('조회 키는 (버전, 로케일, 프롬프트 sha256)이다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        const prompt = callAiProviderRouter.mock.calls.find(
            ([arg]) => arg.jobId === 'analysis-plain'
        )?.[0].contents as string;
        const [version, locale, digest] = findCallFor('ko') ?? [];
        expect(version).toBe(PLAIN_PROMPT_VERSION);
        expect(locale).toBe('ko');
        expect(digest).toBe(createHash('sha256').update(prompt).digest('hex'));
    });

    it('미스면 LLM을 한 번 부르고 같은 키로 한 번 저장한다', async () => {
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
        expect(repoInsert).toHaveBeenCalledOnce();
        // 조회 키와 저장 키가 어긋나면 영영 히트하지 않는다.
        expect(insertCallFor(GOOD.trim())).toEqual([
            ...(findCallFor('ko') ?? []),
            GOOD.trim(),
        ]);
    });

    it('저장이 거절돼도 평이화 결과는 그대로 돌려준다', async () => {
        repoInsert.mockRejectedValue(new Error('db down'));
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(repoInsert).toHaveBeenCalledOnce();
    });

    it('조회가 거절되면 미스로 취급해 생성한다', async () => {
        repoFind.mockRejectedValue(new Error('db down'));
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
    });

    it('빈 문자열 행은 히트로 치지 않는다', async () => {
        repoFind.mockResolvedValue('');
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
    });

    it('근거 없는 숫자를 도려내면 25%를 넘게 잃을 때는 지적을 덧붙여 한 번만 재시도한다', async () => {
        callAiProviderRouter
            .mockResolvedValueOnce(`${GOOD}${LARGE_BAD_TAIL}`)
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
        callAiProviderRouter.mockResolvedValue(`${GOOD}${LARGE_BAD_TAIL}`);

        const result = await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        expect(result).not.toBeNull();
        expect(result).not.toContain('999.99');
        expect(result).toContain('좋은 문장입니다');
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
        // 살려낸 결과도 저장한다 — 다음 조회가 같은 왕복을 반복하지 않는다.
        expect(repoInsert).toHaveBeenCalledOnce();
        expect(insertCallFor(result as string)).toBeDefined();
    });

    /**
     * 위반이 짧으면(원문의 25% 이하) 재생성하지 않고 그 문장만 도려낸다 — 첫 시도 거부의
     * 73%가 근거 없는 숫자였고 대개 문장 한두 개라, LLM을 한 번 더 부를 이유가 없다.
     */
    it('근거 없는 숫자가 짧게 끼면 재시도 없이 도려내 저장한다', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        callAiProviderRouter.mockResolvedValueOnce(
            `${GOOD}\n\n목표가 999.99달러입니다.`
        );

        const result = await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        expect(result).not.toBeNull();
        expect(result).not.toContain('999.99');
        expect(result).toContain('지지선은 183.60달러입니다');
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
        expect(insertCallFor(result as string)).toBeDefined();
        expect(infoSpy).toHaveBeenCalledWith(
            '[analysisPlain] salvaged without retry',
            expect.objectContaining({
                symbol: 'AAPL',
                kind: 'unsupported_numbers',
            })
        );
        // 상한 판정에 쓴 값과 같은 비율이 로그에 남는다 — 0 초과, 상한 이하.
        const logged = infoSpy.mock.calls.find(
            call => call[0] === '[analysisPlain] salvaged without retry'
        )?.[1] as {
            lossRatio: number;
            originalChars: number;
            removedChars: number;
        };
        expect(logged.lossRatio).toBeGreaterThan(0);
        expect(logged.lossRatio).toBeLessThanOrEqual(0.25);
        expect(logged.lossRatio).toBeCloseTo(
            logged.removedChars / logged.originalChars,
            3
        );
    });

    /**
     * 조언 문구도 짧으면 재시도 없이 그 문장만 뺀다 — 숫자 위반과 같이 문장 한두 개라
     * 도려내면 끝난다(2026-10-04: 조언 가드 도입).
     */
    it('조언 문구가 짧게 끼면 재시도 없이 도려내 저장한다', async () => {
        callAiProviderRouter.mockResolvedValueOnce(
            `${GOOD}\n\n그래서 지금 새로 사기에는 불리한 위치입니다.`
        );

        const result = await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        expect(result).not.toBeNull();
        expect(result).not.toContain('사기에는');
        expect(result).toContain('좋은 문장입니다');
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
        expect(insertCallFor(result as string)).toBeDefined();
    });

    /**
     * 조언 문구가 길게 섞여 재시도까지 실패해도 그 문장만 빼고 살린다. 버리면 그 종목의
     * 쉽게보기가 통째로 사라진다.
     */
    it('재시도도 조언 문구로 실패하면 그 문장만 도려내고 살린다', async () => {
        // 원문의 25%를 넘게 차지하게 반복한다 — 그래야 재시도 전 도려내기를 건너뛰고
        // 재생성 경로를 탄다(`SALVAGE_BEFORE_RETRY_MAX_LOSS`).
        const ADVICE =
            '그래서 지금 새로 사기에는 불리한 위치입니다. 나눠서 사는 편이 낫습니다. 확인한 뒤에 움직이는 것이 합리적입니다. '.repeat(
                4
            );
        callAiProviderRouter.mockResolvedValue(`${GOOD}\n\n${ADVICE}`);

        const result = await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');

        expect(result).not.toBeNull();
        expect(result).not.toContain('사기에는');
        expect(result).toContain('좋은 문장입니다');
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
        expect(insertCallFor(result as string)).toBeDefined();
    });

    /** 크기 접미사는 도려내서 고쳐지지 않으므로(10배 금액 오류) 짧아도 재시도한다. */
    it('크기 접미사 위반은 짧아도 재시도한다', async () => {
        callAiProviderRouter
            .mockResolvedValueOnce(`${GOOD}\n\n시가총액은 1,573.1B달러입니다.`)
            .mockResolvedValueOnce(GOOD);

        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
    });

    /** 모든 문장이 어긋난 숫자를 품고 있으면 도려낸 뒤 남는 것이 없어 버린다. */
    it('도려낸 결과가 비면 null', async () => {
        callAiProviderRouter.mockResolvedValue('목표가 999.99달러입니다.');
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(repoInsert).not.toHaveBeenCalled();
    });

    /**
     * 길이 하한이 없다 — 입력 산문보다 훨씬 짧아도 가드를 통과하면 쓴다.
     * 예전에는 200자·입력 20% 미만을 `too_short`로 거부해, 긴 멤버·추론 분석의
     * 쉽게보기 토글이 통째로 사라졌다.
     */
    it('짧은 재작성도 가드를 통과하면 한 번에 쓴다', async () => {
        const SHORT = '지지선은 183.60달러입니다.';
        callAiProviderRouter.mockResolvedValue(SHORT);

        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            SHORT
        );
        expect(callAiProviderRouter).toHaveBeenCalledTimes(1);
        expect(repoInsert).toHaveBeenCalledOnce();
    });

    /** 크기 접미사는 자릿수가 틀린 금액이라 문장 제거로 고쳐지지 않는다. */
    it('크기 접미사 실패는 살리지 않는다', async () => {
        callAiProviderRouter.mockResolvedValue(
            `${GOOD}\n\n총부채는 3,475.2B 원입니다.`
        );
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
        expect(repoInsert).not.toHaveBeenCalled();
    });

    it('LLM이 던져도 예외를 전파하지 않는다 — 분석 전체가 실패하면 안 된다', async () => {
        callAiProviderRouter.mockRejectedValue(new Error('provider down'));
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBeNull();
    });

    it('DB 클라이언트 생성이 던져도 저장소 없이 생성한다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        tryGetDatabaseClient.mockImplementation(() => {
            throw new Error('bad config');
        });
        try {
            expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
                GOOD.trim()
            );
            expect(repoFind).not.toHaveBeenCalled();
            expect(repoInsert).not.toHaveBeenCalled();
        } finally {
            errSpy.mockRestore();
        }
    });

    it('DB 클라이언트가 없어도(로컬·오프라인 빌드) 생성하고 저장은 건너뛴다', async () => {
        tryGetDatabaseClient.mockReturnValue(null);
        expect(await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')).toBe(
            GOOD.trim()
        );
        expect(callAiProviderRouter).toHaveBeenCalledOnce();
        expect(repoFind).not.toHaveBeenCalled();
        expect(repoInsert).not.toHaveBeenCalled();
    });

    it('텔레메트리 분리를 위해 jobId를 지정한다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
        expect(callAiProviderRouter.mock.calls[0][0].jobId).toBe(
            'analysis-plain'
        );
    });

    /**
     * 회귀(감사, 7일 `deadline exceeded` 146건): 레이스에서 진 `attempt()`는
     * 저장(당시엔 Redis 캐시) 쓰기가 승자 경로에만 있던 시절 결과를 통째로 버렸다.
     * 지금은 `attempt()` 자신이 DB 행을 쓰므로, 레이스가 끝난 뒤 프로바이더가 늦게
     * settle해도 다음 요청은 그 결과를 저장소에서 맞는다.
     */
    it('마감을 넘겨도 프로바이더가 나중에 끝나면 행을 저장한다', async () => {
        vi.useFakeTimers();
        try {
            let resolveProvider: (v: string) => void = () => {};
            callAiProviderRouter.mockReturnValue(
                new Promise<string>(resolve => {
                    resolveProvider = resolve;
                })
            );

            const promise = rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
            await vi.advanceTimersByTimeAsync(15_000);
            expect(await promise).toBeNull();
            expect(repoInsert).not.toHaveBeenCalled();

            resolveProvider(GOOD);
            await vi.advanceTimersByTimeAsync(0);
            expect(repoInsert).toHaveBeenCalledOnce();
            expect(insertCallFor(GOOD.trim())).toBeDefined();
        } finally {
            vi.useRealTimers();
        }
    });

    /**
     * 마감을 넘긴 뒤 늦게 도착한 텍스트라도 가드를 통과하지 못하면 여전히
     * 저장소에 쓰지 않는다 — 이번 수정이 "가드를 우회하는 경로"가 되면 안 된다.
     */
    it('마감을 넘긴 뒤 가드가 거부하면 여전히 저장하지 않는다', async () => {
        vi.useFakeTimers();
        try {
            let resolveProvider: (v: string) => void = () => {};
            callAiProviderRouter.mockReturnValue(
                new Promise<string>(resolve => {
                    resolveProvider = resolve;
                })
            );

            const promise = rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
            await vi.advanceTimersByTimeAsync(15_000);
            expect(await promise).toBeNull();

            // 허용 집합에 없는 숫자뿐인 문장 하나 — 도려내면 남는 것이 없어
            // salvage도 실패한다.
            resolveProvider('목표가 999.99달러입니다.');
            await vi.advanceTimersByTimeAsync(0);
            expect(repoInsert).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    /** 프리웜처럼 기다리는 사람이 없는 호출자는 더 긴 마감을 넘길 수 있다. */
    it('호출자가 넘긴 마감을 그대로 쓴다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.useFakeTimers();
        try {
            callAiProviderRouter.mockReturnValue(new Promise<string>(() => {}));

            const promise = rewriteToPlainLanguage(
                ANALYSIS,
                'AAPL',
                'ko',
                undefined,
                undefined,
                30_000
            );
            await vi.advanceTimersByTimeAsync(30_000);
            expect(await promise).toBeNull();
            expect(errSpy).toHaveBeenCalledWith(
                '[analysisPlain] deadline exceeded',
                { ms: 30_000 }
            );
        } finally {
            vi.useRealTimers();
            errSpy.mockRestore();
        }
    });

    /** 마감을 생략하면 사용자 경로 기본값인 15초를 그대로 쓴다. */
    it('마감을 생략하면 15초를 쓴다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.useFakeTimers();
        try {
            callAiProviderRouter.mockReturnValue(new Promise<string>(() => {}));

            const promise = rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
            await vi.advanceTimersByTimeAsync(15_000);
            expect(await promise).toBeNull();
            expect(errSpy).toHaveBeenCalledWith(
                '[analysisPlain] deadline exceeded',
                { ms: 15_000 }
            );
        } finally {
            vi.useRealTimers();
            errSpy.mockRestore();
        }
    });

    it('로케일이 저장 키를 가른다', async () => {
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
        const koKey = findCallFor('ko')?.slice(0, 3).join('|');
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        repoFind.mockResolvedValue(null);
        repoInsert.mockResolvedValue(undefined);
        tryGetDatabaseClient.mockReturnValue({ db: {} });
        tryReadPlainModelConfig.mockReturnValue({
            serverApiKey: 'k',
            model: 'deepseek-v4.1-flash',
        });
        callAiProviderRouter.mockResolvedValue(GOOD);
        await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ja');
        const jaKey = findCallFor('ja')?.slice(0, 3).join('|');
        expect(koKey).toBeDefined();
        expect(jaKey).toBeDefined();
        expect(jaKey).not.toBe(koKey);
    });

    /**
     * DB 클라이언트에는 쿼리 단위 타임아웃이 없다. 조회가 매달리면 `withDeadline` 바깥의
     * 이 await가 그대로 사용자 대기가 되므로, 상한을 넘기면 미스로 보고 생성한다.
     */
    describe('저장소 조회 상한', () => {
        it('끝나지 않는 조회는 상한 뒤 미스로 취급해 생성으로 넘어간다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.useFakeTimers();
            try {
                repoFind.mockReturnValue(new Promise<string | null>(() => {}));

                const promise = rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
                await vi.advanceTimersByTimeAsync(
                    PLAIN_STORE_READ_TIMEOUT_MS - 1
                );
                expect(callAiProviderRouter).not.toHaveBeenCalled();

                await vi.advanceTimersByTimeAsync(1);
                expect(await promise).toBe(GOOD.trim());
                expect(callAiProviderRouter).toHaveBeenCalledOnce();
                expect(insertCallFor(GOOD.trim())).toBeDefined();
                expect(warnSpy).toHaveBeenCalledWith(
                    '[analysisPlain] store read timed out',
                    { ms: PLAIN_STORE_READ_TIMEOUT_MS }
                );
            } finally {
                vi.useRealTimers();
                warnSpy.mockRestore();
            }
        });

        it('상한 안에 끝난 조회는 타이머를 남기지 않고 히트로 쓴다', async () => {
            vi.useFakeTimers();
            try {
                repoFind.mockResolvedValue(GOOD);
                expect(
                    await rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko')
                ).toBe(GOOD);
                expect(vi.getTimerCount()).toBe(0);
                expect(callAiProviderRouter).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });

        it('상한 뒤에 늦게 끝난 조회는 결과를 바꾸지 못한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.useFakeTimers();
            try {
                let resolveFind: (v: string) => void = () => {};
                repoFind.mockReturnValue(
                    new Promise<string>(resolve => {
                        resolveFind = resolve;
                    })
                );

                const promise = rewriteToPlainLanguage(ANALYSIS, 'AAPL', 'ko');
                await vi.advanceTimersByTimeAsync(PLAIN_STORE_READ_TIMEOUT_MS);
                expect(await promise).toBe(GOOD.trim());

                resolveFind('늦게 온 다른 텍스트');
                await vi.advanceTimersByTimeAsync(0);
                expect(callAiProviderRouter).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
                warnSpy.mockRestore();
            }
        });
    });

    /**
     * 저장소가 없으면 모든 요청이 LLM을 다시 부른다(비용). 막지는 않되 조용히
     * 넘어가지 않는다 — 프로세스당 한 번만 크게 남긴다. 모듈 수준 플래그라 테스트마다
     * 모듈을 새로 불러온다.
     */
    describe('DB 부재 경보', () => {
        const MESSAGE =
            '[analysis-plain] DB unavailable — plain texts will be regenerated on every request (LLM cost)';

        async function freshRewrite() {
            vi.resetModules();
            return (await import('../api')).rewriteToPlainLanguage;
        }

        const unavailableCalls = (spy: { mock: { calls: unknown[][] } }) =>
            spy.mock.calls.filter(call => call[0] === MESSAGE);

        it('DB가 없으면 프로세스당 한 번만 console.error를 남긴다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                tryGetDatabaseClient.mockReturnValue(null);
                const rewrite = await freshRewrite();

                await rewrite(ANALYSIS, 'AAPL', 'ko');
                await rewrite(ANALYSIS, 'MSFT', 'ko');

                expect(unavailableCalls(errSpy)).toHaveLength(1);
                expect(callAiProviderRouter).toHaveBeenCalledTimes(2);
            } finally {
                errSpy.mockRestore();
            }
        });

        it('DB가 있으면 남기지 않는다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                const rewrite = await freshRewrite();
                await rewrite(ANALYSIS, 'AAPL', 'ko');
                expect(unavailableCalls(errSpy)).toHaveLength(0);
            } finally {
                errSpy.mockRestore();
            }
        });

        it('오프라인 빌드에서는 남기지 않는다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                tryGetDatabaseClient.mockReturnValue(null);
                isOfflineBuild.mockReturnValue(true);
                const rewrite = await freshRewrite();
                await rewrite(ANALYSIS, 'AAPL', 'ko');
                expect(unavailableCalls(errSpy)).toHaveLength(0);
            } finally {
                errSpy.mockRestore();
            }
        });

        it('E2E에서는 남기지 않는다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                tryGetDatabaseClient.mockReturnValue(null);
                // 진입부의 E2E 단락을 지난 뒤에 E2E로 보이는 경우까지 가드가 막는지 본다.
                isE2E.mockReturnValueOnce(false).mockReturnValue(true);
                const rewrite = await freshRewrite();
                await rewrite(ANALYSIS, 'AAPL', 'ko');
                expect(unavailableCalls(errSpy)).toHaveLength(0);
            } finally {
                errSpy.mockRestore();
            }
        });
    });
});
