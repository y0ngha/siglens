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
    mockResolvePriceAsOf,
    mockClaimBasisForce,
    mockFetchPageLastClose,
    mockAddFmpBudget,
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
    mockResolvePriceAsOf: vi.fn(),
    mockClaimBasisForce: vi.fn(),
    mockFetchPageLastClose: vi.fn(),
    mockAddFmpBudget: vi.fn(),
}));

vi.mock('../lock', () => ({
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    markStructurallyUnavailable: mockMarkStructural,
    clearStructurallyUnavailable: mockClearStructural,
    claimBasisForce: mockClaimBasisForce,
    addFmpBudget: mockAddFmpBudget,
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
}));
vi.mock('@/entities/news-article/lib/hasAnalyzableNews', () => ({
    hasAnalyzableNews: mockHasAnalyzableNews,
}));

vi.mock('../lastClose', () => ({
    fetchPageLastClose: mockFetchPageLastClose,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
}));

vi.mock('@/entities/analysis-plain/api', () => ({
    rewriteToPlainLanguage: mockRewriteToPlainLanguage,
}));
vi.mock('@/entities/analysis-plain/lib/currentPrice', () => ({
    resolveCurrentPrice: mockResolveCurrentPrice,
    resolvePriceAsOf: mockResolvePriceAsOf,
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
        indexNowSubmitted: 0,
        indexNowOk: 0,
        indexNowFailed: 0,
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

// 렌더 가능한 산문이 있는 결과 — harvest는 `hasProseForTab`을 통과하지 못하는 결과를 저장하지 않는다.
const OVERALL_PROSE = { headlineKo: '종합 분석 헤드라인입니다.' } as const;

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
            result: OVERALL_PROSE,
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
        expect(call.content).toEqual(OVERALL_PROSE);
        expect(call.model).toBe(DEEPSEEK_V4_1_FLASH_MODEL);
        expect(typeof call.model).toBe('string');
        expect(call.model.length).toBeGreaterThan(0);
        expect(call.generatedAt).toBeInstanceOf(Date);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('평이화를 프리웜 전용 30초 마감으로 호출하고 그 결과를 함께 저장한다', async () => {
        mockResolveCurrentPrice.mockResolvedValue(123.45);
        mockResolvePriceAsOf.mockResolvedValue('9월 29일 종가');
        mockRewriteToPlainLanguage.mockResolvedValue('쉽게 쓴 글');
        const done: SeamOutcome = {
            status: 'done',
            result: OVERALL_PROSE,
        };

        await resolveHarvest('AAPL', 'overall', done, repo as never, counts);

        // 기준 시점은 구운 분석(`dataAsOf`가 든 payload)에서 만든다.
        expect(mockResolvePriceAsOf).toHaveBeenCalledWith(
            'AAPL',
            'ko',
            OVERALL_PROSE
        );
        expect(mockRewriteToPlainLanguage).toHaveBeenCalledWith(
            OVERALL_PROSE,
            'AAPL',
            'ko',
            'USD',
            123.45,
            '9월 29일 종가',
            30_000
        );
        expect(repo.upsert.mock.calls[0][0].plain).toBe('쉽게 쓴 글');
    });

    it('status=done도 cached와 동일하게 upsert하고 true를 반환한다', async () => {
        const done: SeamOutcome = {
            status: 'done',
            result: OVERALL_PROSE,
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
                {
                    status: 'done',
                    result: { summaryKo: '의회 거래 요약 문단입니다.' },
                } as never,
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

describe('resolveHarvest — 렌더 가능한 산문이 없는 결과', () => {
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn() };
        counts = makeCounts();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['technical', { foo: 'bar' }],
        ['news', { currentDriverKo: '   ', keyEventsKo: [] }],
    ] as const)(
        '%s: upsert를 건너뛰고(옛 행 보존) 평이화도 부르지 않고 TRANSIENT backoff를 건다',
        async (tab, content) => {
            const ok = await resolveHarvest(
                'AAPL',
                tab,
                { status: 'done', result: content } as never,
                repo as never,
                counts
            );

            expect(ok).toBe(false);
            expect(repo.upsert).not.toHaveBeenCalled();
            expect(mockRewriteToPlainLanguage).not.toHaveBeenCalled();
            expect(counts.harvested).toBe(0);
            expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', tab, 1800);
            expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', tab);
            expect(mockClearStructural).not.toHaveBeenCalled();
        }
    );
});

/**
 * 기준일 검사 — harvest가 `cached`를 "방금 만든 것"으로 오인해 옛 분석에 오늘 날짜를 찍던
 * 결함(2026-10-05 운영 감사)의 회귀 방지.
 */
describe('resolveHarvest — 기준일 검사(technical)', () => {
    // 금요일 2026-10-02 EDT 마감 20:00Z(경계). now는 같은 날 21:00Z.
    const NOW = new Date('2026-10-02T21:00:00Z');
    const seam = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        fmpSymbol: undefined,
    };
    const ctx = { seam, now: NOW };
    // harvest는 렌더 가능한 산문(`hasProseForTab`)이 없는 결과를 저장하지 않는다 — 모든 픽스처가 산문을 싣는다.
    const PROSE = {
        summary: '추세와 거래량을 요약한 분석 문장입니다.',
    } as const;
    const STALE_RESULT = {
        ...PROSE,
        analyzedAt: '2026-10-02T18:00:00.000Z', // 장중 분석
        planCheck: { currentPrice: 100 },
    };
    const FRESH_RESULT = {
        ...PROSE,
        analyzedAt: '2026-10-02T20:45:00.000Z',
        dataAsOf: {
            barTime: Date.parse('2026-10-02T00:00:00Z') / 1000,
            close: 110,
        },
    };
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    /** `(symbol, tab)`로 upsert 호출을 찾는다 — 호출 인덱스에 기대지 않는다. */
    function upsertedContent(symbol: string, tab: string): unknown {
        const call = repo.upsert.mock.calls.find(
            ([row]) => row.symbol === symbol && row.tab === tab
        );
        expect(call).toBeDefined();
        return call?.[0].content;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn().mockResolvedValue(undefined) };
        counts = makeCounts();
        mockRewriteToPlainLanguage.mockResolvedValue(null);
        mockResolveCurrentPrice.mockResolvedValue(undefined);
        mockClaimBasisForce.mockResolvedValue(true);
        mockFetchPageLastClose.mockResolvedValue(null);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('기준이 신선하면 강제 없이 그대로 저장한다', async () => {
        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: FRESH_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(true);
        expect(mockClaimBasisForce).not.toHaveBeenCalled();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(upsertedContent('AAPL', 'technical')).toEqual(FRESH_RESULT);
        expect(mockMarkSkipped).not.toHaveBeenCalled();
    });

    it('stale cached → 마커를 잡고 force=true로 한 번 재생성해 그 결과를 저장한다', async () => {
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: FRESH_RESULT,
        });

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(true);
        const claim = mockClaimBasisForce.mock.calls.find(
            ([symbol, tab]) => symbol === 'AAPL' && tab === 'technical'
        );
        expect(claim).toBeDefined();
        // 경계 시각(ms)이 키에 들어간다 — 10-02 20:00Z(마감 순간, 정착 버퍼는 "완료 판정"에만 쓰인다).
        expect(claim![2]).toBe(Date.parse('2026-10-02T20:00:00Z'));
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            true
        );
        expect(upsertedContent('AAPL', 'technical')).toEqual(FRESH_RESULT);
        expect(mockMarkSkipped).not.toHaveBeenCalled();
        expect(counts.harvested).toBe(1);
    });

    it('마커가 이미 있으면 다시 강제하지 않고 옛 결과를 실제 기준과 함께 저장한 뒤 일시적 backoff를 건다', async () => {
        mockClaimBasisForce.mockResolvedValue(false);

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(true);
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        // content가 그대로라 analyzedAt이 실제 기준 시각으로 남는다(캡션이 정직해진다).
        expect(upsertedContent('AAPL', 'technical')).toEqual(STALE_RESULT);
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical', 1800);
    });

    it('강제 결과도 stale이면(데이터 미발행) 저장하고 markSkipped(TRANSIENT) — 루프 없음', async () => {
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: {
                ...PROSE,
                analyzedAt: '2026-10-02T20:50:00.000Z',
                dataAsOf: {
                    barTime: Date.parse('2026-10-01T00:00:00Z') / 1000,
                    close: 100,
                },
            },
        });

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(true);
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical', 1800);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('강제 재생성 결과에 렌더 가능한 산문이 없으면 저장하지 않는다(산문 게이트가 강제 결과에도 적용된다)', async () => {
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: {
                analyzedAt: '2026-10-02T20:50:00.000Z',
                dataAsOf: FRESH_RESULT.dataAsOf,
            },
        });

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(false);
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical', 1800);
    });

    it('status=done이 stale이면 재강제하지 않는다(방금 만든 결과다)', async () => {
        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'done', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(true);
        expect(mockClaimBasisForce).not.toHaveBeenCalled();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical', 1800);
    });

    it('강제 호출이 error를 돌려주면 저장하지 않고 일시적 backoff만 건다', async () => {
        mockPrewarmTechnical.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
        });

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical', 1800);
    });

    it('시각이 신선해도 글의 가격이 페이지 종가와 0.3% 넘게 다르면 stale로 보고 재생성한다', async () => {
        mockFetchPageLastClose.mockResolvedValue(110);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: {
                ...FRESH_RESULT,
                dataAsOf: { ...FRESH_RESULT.dataAsOf, close: 110 },
            },
        });

        await resolveHarvest(
            'AAPL',
            'technical',
            {
                status: 'cached',
                result: {
                    ...FRESH_RESULT,
                    dataAsOf: { ...FRESH_RESULT.dataAsOf, close: 105 },
                },
            },
            repo as never,
            counts,
            ctx
        );

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            true
        );
    });

    it('가격 비교는 dataAsOf.close를 우선한다 — planCheck.currentPrice가 달라도 dataAsOf가 맞으면 재생성하지 않는다', async () => {
        mockFetchPageLastClose.mockResolvedValue(110);

        await resolveHarvest(
            'AAPL',
            'technical',
            {
                status: 'cached',
                result: {
                    ...FRESH_RESULT,
                    dataAsOf: { ...FRESH_RESULT.dataAsOf, close: 110 },
                    planCheck: { currentPrice: 50 },
                },
            },
            repo as never,
            counts,
            ctx
        );

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });

    it('dataAsOf가 없으면 planCheck.currentPrice로 물러나 비교한다', async () => {
        mockFetchPageLastClose.mockResolvedValue(110);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: FRESH_RESULT,
        });

        await resolveHarvest(
            'AAPL',
            'technical',
            {
                status: 'cached',
                // 시각은 신선하고(analyzedAt 경계 이후) dataAsOf는 없다.
                result: {
                    ...PROSE,
                    analyzedAt: '2026-10-02T20:45:00.000Z',
                    planCheck: { currentPrice: 100 },
                },
            },
            repo as never,
            counts,
            ctx
        );

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            true
        );
    });

    it('가격 차이가 0.3% 이내면 재생성하지 않는다', async () => {
        mockFetchPageLastClose.mockResolvedValue(110);

        await resolveHarvest(
            'AAPL',
            'technical',
            {
                status: 'cached',
                result: {
                    ...FRESH_RESULT,
                    dataAsOf: { ...FRESH_RESULT.dataAsOf, close: 110.2 },
                },
            },
            repo as never,
            counts,
            ctx
        );

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });

    it('종가 조회가 상한(12초) 안에 끝나지 않으면 가격 비교를 건너뛴다', async () => {
        vi.useFakeTimers();
        mockFetchPageLastClose.mockReturnValue(new Promise(() => undefined));

        const pending = resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: FRESH_RESULT },
            repo as never,
            counts,
            ctx
        );
        await vi.advanceTimersByTimeAsync(12_000);
        await pending;
        vi.useRealTimers();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(upsertedContent('AAPL', 'technical')).toEqual(FRESH_RESULT);
    });

    it('종가 조회가 실제로 돈 비KR 종목은 FMP 예산에 센다', async () => {
        mockFetchPageLastClose.mockResolvedValue(110);

        await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: FRESH_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(mockAddFmpBudget).toHaveBeenCalledWith(1);
    });

    it('KR 종목(Yahoo)과 조회하지 않은 경우(done·시각 stale·크립토)는 FMP 예산에 세지 않는다', async () => {
        await resolveHarvest(
            '005930.KS',
            'technical',
            { status: 'cached', result: FRESH_RESULT },
            repo as never,
            counts,
            { seam: { ...seam, symbol: '005930.KS' }, now: NOW }
        );
        await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'done', result: FRESH_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(mockAddFmpBudget).not.toHaveBeenCalled();
    });

    it('종가를 못 읽으면(null) 가격 비교를 건너뛴다', async () => {
        mockFetchPageLastClose.mockResolvedValue(null);

        await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: FRESH_RESULT },
            repo as never,
            counts,
            ctx
        );

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('크립토는 가격 비교를 하지 않는다', async () => {
        mockFetchPageLastClose.mockResolvedValue(50_000);

        await resolveHarvest(
            'BTCUSD',
            'technical',
            {
                status: 'cached',
                result: {
                    ...PROSE,
                    analyzedAt: '2026-10-02T21:00:00.000Z',
                    dataAsOf: {
                        barTime: Date.parse('2026-10-02T00:00:00Z') / 1000,
                        close: 100,
                    },
                },
            },
            repo as never,
            counts,
            { seam: { ...seam, symbol: 'BTCUSD' }, now: NOW }
        );

        expect(mockFetchPageLastClose).not.toHaveBeenCalled();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });

    // 2026-10-06 운영 재현: FMP가 자정 직후 오늘 봉을 내지 않아 강제 재생성 결과가 "어제 완료 봉
    // + 오늘 00:00Z 이후 실행"으로 돌아온다. 이걸 stale로 보면 크립토 전 종목이 매일 강제 재생성되고도
    // 일시적 backoff에 묶였다(29/29).
    it.each([
        [
            '이틀 전 봉을 쓴 옛 분석',
            {
                analyzedAt: '2026-10-05T10:00:00.000Z',
                barTime: '2026-10-04T00:00:00Z',
            },
        ],
        [
            '어제 봉을 어제 장중에 쓴 옛 분석',
            {
                analyzedAt: '2026-10-05T14:00:00.000Z',
                barTime: '2026-10-05T00:00:00Z',
            },
        ],
    ])(
        '크립토: stale cached(%s) → 강제 재생성이 어제 완료 봉(오늘 실행)을 쓰면 저장하고 backoff를 걸지 않는다',
        async (_label, stale) => {
            const cryptoNow = new Date('2026-10-06T03:00:00Z'); // 경계 = 10-06 00:30Z
            const cryptoCtx = {
                seam: { ...seam, symbol: 'BTCUSD', companyName: 'Bitcoin' },
                now: cryptoNow,
            };
            const forced = {
                ...PROSE,
                analyzedAt: '2026-10-06T00:55:00.000Z',
                dataAsOf: {
                    barTime: Date.parse('2026-10-05T00:00:00Z') / 1000,
                    close: 60_000,
                },
            };
            mockPrewarmTechnical.mockResolvedValue({
                status: 'done',
                result: forced,
            });

            const ok = await resolveHarvest(
                'BTCUSD',
                'technical',
                {
                    status: 'cached',
                    result: {
                        ...PROSE,
                        analyzedAt: stale.analyzedAt,
                        dataAsOf: {
                            barTime: Date.parse(stale.barTime) / 1000,
                            close: 59_000,
                        },
                    },
                },
                repo as never,
                counts,
                cryptoCtx
            );

            expect(ok).toBe(true);
            const claim = mockClaimBasisForce.mock.calls.find(
                ([symbol, tab]) => symbol === 'BTCUSD' && tab === 'technical'
            );
            expect(claim).toBeDefined();
            expect(mockPrewarmTechnical).toHaveBeenCalledWith(
                'BTCUSD',
                'Bitcoin',
                undefined,
                true
            );
            expect(upsertedContent('BTCUSD', 'technical')).toEqual(forced);
            expect(mockMarkSkipped).not.toHaveBeenCalled();
            expect(counts.harvested).toBe(1);
        }
    );

    it('technical이 아닌 탭은 검사하지 않는다', async () => {
        await resolveHarvest(
            'AAPL',
            'news',
            {
                status: 'cached',
                result: {
                    ...STALE_RESULT,
                    currentDriverKo: '뉴스 동인 문장입니다.',
                },
            },
            repo as never,
            counts,
            ctx
        );

        expect(mockClaimBasisForce).not.toHaveBeenCalled();
        expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('basis 문맥이 없으면(기존 호출부) 검사하지 않는다', async () => {
        await resolveHarvest(
            'AAPL',
            'technical',
            { status: 'cached', result: STALE_RESULT },
            repo as never,
            counts
        );

        expect(mockClaimBasisForce).not.toHaveBeenCalled();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });
});
