import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { PrewarmBatchCounts } from '../runPrewarmBatch';
import type { SeamOutcome } from '../harvest';

const {
    mockMarkSkipped,
    mockClearInFlight,
    mockMarkStructural,
    mockClearStructural,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
    mockHasAnalyzableNews,
    mockRewriteToPlainLanguage,
    mockResolveCurrentPrice,
} = vi.hoisted(() => ({
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockMarkStructural: vi.fn(),
    mockClearStructural: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
    mockHasAnalyzableNews: vi.fn(),
    mockRewriteToPlainLanguage: vi.fn(),
    mockResolveCurrentPrice: vi.fn(),
}));

vi.mock('../lock', () => ({
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    markStructurallyUnavailable: mockMarkStructural,
    clearStructurallyUnavailable: mockClearStructural,
    // 구현과 동일한 값(lock.ts). 일시적 실패 backoff TTL.
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
    // 구현과 동일한 값(lock.ts). "최근 뉴스 없음" backoff TTL.
    NO_RECENT_NEWS_SKIP_TTL_SECONDS: 86400,
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
    DrizzleNewsRepository: class {},
    hasAnalyzableNews: mockHasAnalyzableNews,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
}));

vi.mock('@/entities/analysis-plain', () => ({
    rewriteToPlainLanguage: mockRewriteToPlainLanguage,
    resolveCurrentPrice: mockResolveCurrentPrice,
}));

import { TAB_SEAMS, resolveHarvest } from '../harvest';

const CTX = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: undefined,
};

function makeCounts(): PrewarmBatchCounts {
    return {
        harvested: 0,
        revalidated: 0,
        remaining: 0,
        fmpBudgetUsed: 0,
        staleTotal: 0,
        durationMs: 0,
    };
}

describe('TAB_SEAMS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrewarmTechnical.mockResolvedValue({ status: 'cached' });
        mockPrewarmOverall.mockResolvedValue({ status: 'cached' });
        mockPrewarmFundamental.mockResolvedValue({ status: 'cached' });
        mockPrewarmFinancials.mockResolvedValue({ status: 'cached' });
        mockPrewarmCongress.mockResolvedValue({ status: 'cached' });
        mockPrewarmNews.mockResolvedValue({ status: 'cached' });
        mockPrewarmOptions.mockResolvedValue({ status: 'cached' });
    });

    it('dispatches technical with force=false', async () => {
        await TAB_SEAMS.technical(CTX);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            false
        );
    });

    it('dispatches overall with force=false', async () => {
        await TAB_SEAMS.overall(CTX);
        expect(mockPrewarmOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches fundamental with force=false', async () => {
        await TAB_SEAMS.fundamental(CTX);
        expect(mockPrewarmFundamental).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches financials with force=false', async () => {
        await TAB_SEAMS.financials(CTX);
        expect(mockPrewarmFinancials).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches congress with force=false', async () => {
        await TAB_SEAMS.congress(CTX);
        expect(mockPrewarmCongress).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches news with force=false', async () => {
        await TAB_SEAMS.news(CTX);
        expect(mockPrewarmNews).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches options with force=false', async () => {
        await TAB_SEAMS.options(CTX);
        expect(mockPrewarmOptions).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });
});

describe('resolveHarvest', () => {
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn() };
        counts = makeCounts();
    });

    it('null result: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            null,
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical');
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'technical');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:technical — null result'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    it('upserts cached result with PREWARM model + generatedAt, returns true, clears in-flight', async () => {
        const cached: SeamOutcome = {
            status: 'cached',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            cached,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        const call = repo.upsert.mock.calls[0][0];
        expect(call.symbol).toBe('AAPL');
        expect(call.tab).toBe('overall');
        expect(call.content).toEqual({ foo: 'bar' });
        expect(call.model).toBe(DEEPSEEK_V4_1_FLASH_MODEL);
        expect(typeof call.model).toBe('string');
        expect(call.model.length).toBeGreaterThan(0);
        expect(call.generatedAt).toBeInstanceOf(Date);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('평이화를 프리웜 전용 30초 마감으로 호출하고 그 결과를 함께 저장한다', async () => {
        mockResolveCurrentPrice.mockResolvedValue(123.45);
        mockRewriteToPlainLanguage.mockResolvedValue('쉽게 쓴 글');
        const done: SeamOutcome = {
            status: 'done',
            result: { foo: 'bar' },
        };

        await resolveHarvest('AAPL', 'overall', done, repo as never, counts);

        expect(mockRewriteToPlainLanguage).toHaveBeenCalledWith(
            { foo: 'bar' },
            'AAPL',
            'ko',
            'USD',
            123.45,
            30_000
        );
        expect(repo.upsert.mock.calls[0][0].plain).toBe('쉽게 쓴 글');
    });

    it('status=done도 cached와 동일하게 upsert하고 true를 반환한다', async () => {
        const done: SeamOutcome = {
            status: 'done',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            done,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('terminal status=error: markSkipped + clearInFlight + warn, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'congress',
            { status: 'error' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        // FMP fetch 실패는 throw가 아니라 이 status로 **반환**된다. 6시간을 걸면
        // FMP 장애 한 번이 4개 축을 그날 밤 내내 배제한다 — 30분이어야 한다.
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'congress', 1800);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'congress');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:congress — status=error'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    describe('뉴스 의존 탭의 no_news 갈래는', () => {
        it("news 탭이 code='no_news'이고 분석 가능한 뉴스가 0건이면 24h backoff", async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockHasAnalyzableNews.mockResolvedValue(false);

            const ok = await resolveHarvest(
                'SQQQ',
                'news',
                { status: 'error', code: 'no_news' },
                repo as never,
                counts
            );

            expect(ok).toBe(false);
            expect(mockMarkSkipped).toHaveBeenCalledWith('SQQQ', 'news', 86400);
            // 영구 확정은 하지 않는다 — 기사가 다시 나오면 복구돼야 한다.
            expect(mockMarkStructural).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(
                '[seo-prewarm] skip SQQQ:news — status=error code=no_news' +
                    ' (no analyzable news in window — 24h backoff)'
            );

            warnSpy.mockRestore();
        });

        /**
         * core 1.14.0부터 overall은 뉴스 축의 `no_news`를 abstain으로 처리하므로
         * 뉴스가 없다고 실패하지 않는다. 즉 overall이 `axis:'news'`로 떨어지는 건
         * 재시도하면 달라지는 실패(뉴스 LLM·사용량 한도)뿐이라 30분이 맞다.
         */
        it("overall 탭은 axis='news'여도 24h로 묶지 않는다", async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockHasAnalyzableNews.mockResolvedValue(false);

            await resolveHarvest(
                'SQQQ',
                'overall',
                { status: 'error', axis: 'news' },
                repo as never,
                counts
            );

            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'SQQQ',
                'overall',
                1800
            );
            // DB 조회 자체를 하지 않는다 — 배치 데드라인에 불필요한 왕복을 안 얹는다.
            expect(mockHasAnalyzableNews).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });

        it('뉴스가 실제로 있으면 news 탭 실패여도 30분 backoff를 유지한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            // 재료는 있는데 실패했다 = 뉴스 LLM 일시 장애. 24h를 걸면 그날 밤을 날린다.
            mockHasAnalyzableNews.mockResolvedValue(true);

            await resolveHarvest(
                'AAPL',
                'news',
                { status: 'error', code: 'no_news' },
                repo as never,
                counts
            );

            expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'news', 1800);

            warnSpy.mockRestore();
        });

        /**
         * 적재가 실패한 밤은 DB가 비어 있어도 "뉴스가 없다"의 증거가 아니다.
         * 30분 티어가 지키려던 바로 그 상황(FMP 장애)이라 24h로 묶으면 안 된다.
         */
        it('적재 실패(newsFetchFailed)면 DB가 비어도 30분을 유지한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockHasAnalyzableNews.mockResolvedValue(false);

            await resolveHarvest(
                'NEWSYM',
                'news',
                { status: 'error', code: 'no_news', newsFetchFailed: true },
                repo as never,
                counts
            );

            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'NEWSYM',
                'news',
                1800
            );

            warnSpy.mockRestore();
        });

        it('뉴스와 무관한 축(technical) 실패는 DB를 보지 않고 30분을 유지한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'overall',
                { status: 'error', axis: 'technical' },
                repo as never,
                counts
            );

            expect(mockHasAnalyzableNews).not.toHaveBeenCalled();
            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'AAPL',
                'overall',
                1800
            );

            warnSpy.mockRestore();
        });

        it('뉴스 의존 탭이 아니면 DB를 보지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'financials',
                { status: 'error', code: 'no_news' },
                repo as never,
                counts
            );

            expect(mockHasAnalyzableNews).not.toHaveBeenCalled();
            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'AAPL',
                'financials',
                1800
            );

            warnSpy.mockRestore();
        });
    });

    it('terminal status=miss_no_trigger: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'news',
            { status: 'miss_no_trigger' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        // 구조적으로 불가능한 케이스는 기본 6시간을 유지한다(TTL 인자 없음).
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'news', undefined);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'news');
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    /**
     * 2026-08-30 실측 — `no_trades`인 `congress` 탭은 행이 영원히 안 생기고,
     * stale 판정이 "탭 하나라도 not-fresh면 stale"이라 그 심볼이 **영구 stale**로
     * 굳었다. `staleTotal`이 113에 고정된 채 `harvested: 0`이 8시간 이어졌고,
     * 나머지 6탭이 멀쩡한 종목들이 매 회전마다 배치 슬롯을 소진했다.
     *
     * backoff 마커만으로는 못 막는다 — TTL이 지나면 되살아나기 때문이다. 구조적
     * 불가는 **영속** 집합으로 따로 기록해야 stale 판정에서 뺄 수 있다.
     */
    describe('구조적 불가 확정', () => {
        it.each(['no_trades', 'no_chains_error'] as const)(
            '%s: 영속 집합에 넣는다',
            async status => {
                const warnSpy = vi
                    .spyOn(console, 'warn')
                    .mockImplementation(() => {});

                await resolveHarvest(
                    'AAPL',
                    'congress',
                    { status } as never,
                    repo as never,
                    counts
                );

                expect(mockMarkStructural).toHaveBeenCalledWith(
                    'AAPL',
                    'congress'
                );
                warnSpy.mockRestore();
            }
        );

        it.each([
            [
                'miss_no_trigger',
                // core 계약상 `skipEnqueueIfMiss: true`일 때만 나오는 caller 설정
                // 산물이다. 지금은 전 seam이 false라 도달 불가능하지만, 확정해 두면
                // 훗날 그 플래그가 켜지는 순간 일시적 응답이 영구 블랙리스트된다.
                { status: 'miss_no_trigger' },
            ],
            [
                'null 결과',
                // `prewarmOptions`의 NoChains 경로. `fetchOptionsSnapshot`의 null은
                // "옵션 없는 종목"과 "Yahoo 일시 장애"를 구분하지 않는다.
                null,
            ],
        ] as const)('%s는 영속 집합에 넣지 않는다', async (_label, outcome) => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'options',
                outcome as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('error(일시적)는 영속 집합에 넣지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            // FMP 장애 한 번이 이 경로로 들어온다. 영구 확정하면 장애가 끝나도
            // 그 유닛이 다시는 안 만들어진다.
            await resolveHarvest(
                'AAPL',
                'fundamental',
                { status: 'error' } as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            // 일시적이므로 짧은 backoff는 그대로 걸린다.
            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'AAPL',
                'fundamental',
                1800
            );
            warnSpy.mockRestore();
        });

        /**
         * `SeamOutcome.status`는 `string`이라 타입이 좁혀지지 않는다. 부정 조건
         * (`!isTransient && status !== 'miss_no_trigger'`)이었다면 코드가 모르는
         * 미래의 status가 기본값으로 영구 블랙리스트됐다 — 확정은 TTL이 없어
         * 되돌리기 어려운 방향이라 모를 때는 확정하지 않아야 한다.
         */
        it('알 수 없는 status는 확정하지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'congress',
                { status: 'submitted' } as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('성공하면 확정을 해제한다(자동 복구 경로)', async () => {
            await resolveHarvest(
                'AAPL',
                'congress',
                { status: 'done', result: { any: 'payload' } } as never,
                repo as never,
                counts
            );

            expect(repo.upsert).toHaveBeenCalled();
            expect(mockClearStructural).toHaveBeenCalledWith(
                'AAPL',
                'congress'
            );
        });
    });
});
