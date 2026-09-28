const {
    mockIsRecentlyFetched,
    mockIngestNewsForSymbol,
    mockRevalidateTag,
    mockAnalyzeNewsCards,
    mockAfter,
    mockListBySymbol,
    mockSelectUnanalyzed,
    FakeNewsIngestWriteError,
} = vi.hoisted(() => ({
    mockIsRecentlyFetched: vi.fn(),
    mockIngestNewsForSymbol: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockAnalyzeNewsCards: vi.fn(),
    mockAfter: vi.fn(),
    mockListBySymbol: vi.fn(),
    mockSelectUnanalyzed: vi.fn(),
    FakeNewsIngestWriteError: class extends Error {
        constructor() {
            super('majority upsert failure');
            this.name = 'NewsIngestWriteError';
        }
    },
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {
        listBySymbol = mockListBySymbol;
    },
    ingestNewsForSymbol: mockIngestNewsForSymbol,
    isRecentlyFetched: mockIsRecentlyFetched,
    // 구현과 동일한 값(lib/newsLookback.ts). 분석 창 30일.
    NEWS_ANALYSIS_LOOKBACK_MS: 30 * 24 * 60 * 60 * 1000,
    NewsIngestWriteError: FakeNewsIngestWriteError,
    analyzeNewsCards: mockAnalyzeNewsCards,
    VISITOR_NEWS_CARD_LIMIT: 25,
    // 구현과 동일한 값(lib/newsAnalysisConstants.ts). 동시성 4 = 한 청크.
    CHAT_SYNC_NEWS_CARD_LIMIT: 4,
    // 선별 규칙은 `selectUnanalyzed`의 자체 테스트가 고정한다. 여기서는 그
    // 규칙이 아니라 **선별 결과를 어떻게 쓰는지**(동기/배경 분할)를 본다.
    selectUnanalyzed: mockSelectUnanalyzed,
}));
vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

import { ensureSymbolNewsFresh } from '../ensureSymbolDataFresh';

/** `after()`가 받아 둔 콜백들. `flushAfter()`가 순서대로 실행한다. */
const scheduled: Array<() => Promise<void>> = [];

async function flushAfter(): Promise<void> {
    const pending = [...scheduled];
    scheduled.length = 0;
    for (const fn of pending) await fn();
}
import { NEWS_ANALYSIS_LOOKBACK_MS } from '@/entities/news-article/lib/newsLookback';

function ingestResult(changed: number, total = changed) {
    return {
        fresh: [],
        upsertSettled: Array.from({ length: total }, (_, i) => ({
            status: 'fulfilled' as const,
            value: i < changed,
        })),
    };
}

describe('ensureSymbolNewsFresh 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsRecentlyFetched.mockResolvedValue(false);
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(0, 0));
        mockAnalyzeNewsCards.mockResolvedValue(undefined);
        mockListBySymbol.mockResolvedValue([]);
        mockSelectUnanalyzed.mockReturnValue([]);
        scheduled.length = 0;
        // `after()`는 콜백을 **모아만 둔다**. 프로덕션에서도 응답 이후에 도는
        // 작업이라, 테스트가 `flushAfter()`로 명시적으로 돌려야 단언이
        // 마이크로태스크 경합 없이 결정적으로 읽힌다.
        mockAfter.mockImplementation((fn: () => Promise<void>) => {
            scheduled.push(fn);
        });
    });

    it('TTL 내에 이미 수급했으면 적재를 건너뛴다', async () => {
        mockIsRecentlyFetched.mockResolvedValue(true);

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: false,
            changedCount: 0,
        });
        expect(mockIngestNewsForSymbol).not.toHaveBeenCalled();
    });

    it('TTL이 지났으면 적재를 돌린다', async () => {
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(2, 3));

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: true,
            changedCount: 2,
        });
        expect(mockIngestNewsForSymbol).toHaveBeenCalledOnce();
    });

    it('실제로 바뀐 기사가 있을 때만 뉴스 캐시를 무효화한다', async () => {
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(1, 2));

        await ensureSymbolNewsFresh('laes');
        await flushAfter();

        expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
    });

    /**
     * 스트리밍 챗 라우트에서 그 자리에 `revalidateTag`를 부르면 조용히 아무 일도
     * 안 한다 — 요청 컨텍스트가 사라져서가 **아니라**, `executeRevalidates`가
     * 핸들러 반환 시점에 이미 돌아 뒤늦은 push가 flush되지 않기 때문이다
     * (기전 전체는 `scheduleRefreshTail` 주석). 반드시 `after()` 안에서
     * 일어나야 한다.
     */
    it('무효화와 보강은 after()로 스케줄된다 — 그 자리에서 실행하지 않는다', async () => {
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(1, 1));

        await ensureSymbolNewsFresh('LAES');

        expect(mockAfter).toHaveBeenCalledOnce();
        // 콜백을 실행하지 않았으므로 아직 아무것도 일어나지 않아야 한다.
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
    });

    it('스케줄된 작업은 보강을 끝낸 뒤 무효화한다', async () => {
        const order: string[] = [];
        mockAnalyzeNewsCards.mockImplementation(async () => {
            order.push('enrich');
        });
        mockRevalidateTag.mockImplementation(() => {
            order.push('revalidate');
        });
        mockIngestNewsForSymbol.mockResolvedValue({
            fresh: [{ id: 'a' }],
            upsertSettled: [{ status: 'fulfilled', value: true }],
        });
        mockSelectUnanalyzed.mockReturnValue([{ id: 'a' }]);

        await ensureSymbolNewsFresh('LAES');
        await flushAfter();

        // 순서가 반대면 무효화 시점의 미보강 스냅샷이 다시 12시간 굳는다.
        expect(order).toEqual(['enrich', 'revalidate']);
    });

    it('보강이 실패해도 무효화는 한다 — 새 기사는 이미 DB에 있다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockAnalyzeNewsCards.mockRejectedValue(new Error('llm down'));
        mockIngestNewsForSymbol.mockResolvedValue({
            fresh: [{ id: 'a' }],
            upsertSettled: [{ status: 'fulfilled', value: true }],
        });
        mockSelectUnanalyzed.mockReturnValue([{ id: 'a' }]);

        await ensureSymbolNewsFresh('LAES');
        await flushAfter();

        expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        errorSpy.mockRestore();
    });

    it('after()가 동기적으로 throw해도 삼킨다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockAfter.mockImplementation(() => {
            throw new Error('outside request scope');
        });
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(1, 1));

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: true,
            changedCount: 1,
        });

        errorSpy.mockRestore();
    });

    it('바뀐 기사가 없으면 무효화하지 않는다', async () => {
        mockIngestNewsForSymbol.mockResolvedValue(ingestResult(0, 3));

        await ensureSymbolNewsFresh('LAES');

        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    /**
     * 수급 실패가 질문 자체를 죽이면 안 된다 — DB에 있는 것으로 답하는 편이 낫다.
     */
    it('적재가 throw해도 삼키고 skipped를 돌려준다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockIngestNewsForSymbol.mockRejectedValue(new Error('db down'));

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: false,
            changedCount: 0,
        });

        errorSpy.mockRestore();
    });

    /**
     * 창을 좁히지 않으면 기본값 180일이 살아난다 — 읽는 건 30일치뿐인데 6배를
     * Neon에 쓰고, 그 왕복이 **대화 지연에 그대로 얹힌다**.
     */
    it('분석 창(30일) lookback으로 적재한다', async () => {
        await ensureSymbolNewsFresh('LAES');

        expect(mockIngestNewsForSymbol).toHaveBeenCalledWith(
            'LAES',
            expect.anything(),
            NEWS_ANALYSIS_LOOKBACK_MS
        );
    });

    /**
     * `NewsIngestWriteError`(DB 광역 장애)는 `ingestNewsForSymbol`이 **의도적으로**
     * 던지는 유일한 예외다. 문서가 지목하는 그 타입으로 고정한다.
     */
    it('NewsIngestWriteError도 삼키고 skipped를 돌려준다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockIngestNewsForSymbol.mockRejectedValue(
            new FakeNewsIngestWriteError()
        );

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: false,
            changedCount: 0,
        });

        errorSpy.mockRestore();
    });

    it('적재가 null(외부 fetch 실패)이면 skipped로 본다', async () => {
        mockIngestNewsForSymbol.mockResolvedValue(null);

        await expect(ensureSymbolNewsFresh('LAES')).resolves.toEqual({
            refreshed: false,
            changedCount: 0,
        });
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });
});

describe('신규 기사 동기 보강', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsRecentlyFetched.mockResolvedValue(false);
        mockAnalyzeNewsCards.mockResolvedValue(undefined);
        scheduled.length = 0;
        mockAfter.mockImplementation((fn: () => Promise<void>) => {
            scheduled.push(fn);
        });
    });

    function seed(count: number): void {
        const fresh = Array.from({ length: count }, (_, i) => ({
            id: `n${i}`,
        }));
        mockIngestNewsForSymbol.mockResolvedValue({
            fresh,
            upsertSettled: fresh.map(() => ({
                status: 'fulfilled',
                value: true,
            })),
        });
        // `selectUnanalyzed`는 최신순으로 정렬해 돌려준다(자체 테스트가 고정).
        mockSelectUnanalyzed.mockReturnValue(fresh);
    }

    /**
     * 호출부(`get_news`)가 바로 다음에 DB를 읽어 그 턴의 답을 만든다. 여기서
     * 기다려야 방금 들어온 기사가 한국어 제목·감성을 달고 나간다.
     */
    it('신규 기사는 after() 이전에 보강한다 — 그 턴의 답에 들어가야 한다', async () => {
        seed(2);

        await ensureSymbolNewsFresh('LAES');

        // flushAfter() 없이 이미 불렸어야 한다.
        expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
        expect(mockAnalyzeNewsCards.mock.calls[0]![2]).toMatchObject({
            logLabel: 'chatNewsRefreshSync',
        });
    });

    /**
     * 상한이 없으면 첫 방문 심볼에서 30일치 전체를 기다리게 된다. 한 청크(4)로
     * 끊고 나머지는 응답 이후로 넘긴다.
     */
    it('상한을 넘는 기사는 동기로 기다리지 않고 배경으로 넘긴다', async () => {
        seed(7);

        await ensureSymbolNewsFresh('LAES');

        expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
        expect(mockAnalyzeNewsCards.mock.calls[0]![0]).toHaveLength(4);

        await flushAfter();

        expect(mockAnalyzeNewsCards).toHaveBeenCalledTimes(2);
        expect(mockAnalyzeNewsCards.mock.calls[1]![0]).toHaveLength(3);
        expect(mockAnalyzeNewsCards.mock.calls[1]![2]).toMatchObject({
            logLabel: 'chatNewsRefreshBackground',
        });
    });

    it('최신 기사가 먼저 동기 보강된다', async () => {
        seed(6);

        await ensureSymbolNewsFresh('LAES');

        const syncIds = (
            mockAnalyzeNewsCards.mock.calls[0]![0] as Array<{ id: string }>
        ).map(i => i.id);
        // `selectUnanalyzed`가 최신순으로 주므로 앞에서부터 잘린다.
        expect(syncIds).toEqual(['n0', 'n1', 'n2', 'n3']);
    });

    it('상한 이하면 배경 보강을 아예 걸지 않는다', async () => {
        seed(2);

        await ensureSymbolNewsFresh('LAES');
        await flushAfter();

        expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
    });
});

/**
 * 이 경로는 `get_news` 안에서 돈다. `get_news`는 `costClass: 'free'`라 core의
 * `TOOL_TIMEOUT_MS.free = 30_000`을 받고, 넘기면 `runAgentTurn`이 그 툴을
 * `{ error: 'timeout' }`으로 접어 **모델이 기사를 한 건도 못 받는다**. 적재와
 * 보강 **둘 다** 혼자서 30초를 넘길 수 있으므로(FMP 재시도 사다리 / LLM 재시도)
 * 각각 벽시계 예산을 든다.
 */
describe('수급 벽시계 예산', () => {
    /** 수동으로 resolve할 수 있는 프라미스. 버려진 작업이 "계속 돈다"를 흉내낸다. */
    function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
        let resolve!: (v: T) => void;
        const promise = new Promise<T>(r => {
            resolve = r;
        });
        return { promise, resolve };
    }

    function freshIngest(count: number) {
        const fresh = Array.from({ length: count }, (_, i) => ({
            id: `n${i}`,
        }));
        return {
            fresh,
            upsertSettled: fresh.map(() => ({
                status: 'fulfilled' as const,
                value: true,
            })),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockIsRecentlyFetched.mockResolvedValue(false);
        mockListBySymbol.mockResolvedValue([]);
        scheduled.length = 0;
        mockAfter.mockImplementation((fn: () => Promise<void>) => {
            scheduled.push(fn);
        });
        mockIngestNewsForSymbol.mockResolvedValue(freshIngest(2));
        mockSelectUnanalyzed.mockReturnValue(freshIngest(2).fresh);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('적재', () => {
        it('예산을 넘기면 기다리지 않고 deferred로 답을 내보낸다', async () => {
            mockIngestNewsForSymbol.mockReturnValue(deferred().promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(8_000);

            await expect(pending).resolves.toEqual({
                refreshed: true,
                changedCount: 0,
                deferred: true,
            });
        });

        it('예산 전에는 기다린다 — 성급히 포기하지 않는다', async () => {
            mockIngestNewsForSymbol.mockReturnValue(deferred().promise);
            let settled = false;
            void ensureSymbolNewsFresh('LAES').then(() => {
                settled = true;
            });

            await vi.advanceTimersByTimeAsync(7_000);

            expect(settled).toBe(false);
        });

        /**
         * 다시 부르면 FMP 왕복을 두 번 낸다. 같은 프라미스를 `after()`가
         * 이어받아야 한 번으로 끝난다.
         */
        it('넘어간 적재를 다시 부르지 않고 같은 프라미스를 이어받는다', async () => {
            const ingest = deferred<ReturnType<typeof freshIngest>>();
            mockIngestNewsForSymbol.mockReturnValue(ingest.promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(8_000);
            await pending;

            expect(mockIngestNewsForSymbol).toHaveBeenCalledOnce();

            ingest.resolve(freshIngest(2));
            await flushAfter();

            expect(mockIngestNewsForSymbol).toHaveBeenCalledOnce();
            expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
            expect(mockAnalyzeNewsCards.mock.calls[0]![2]).toMatchObject({
                logLabel: 'chatNewsRefreshDeferred',
            });
            expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        });
    });

    describe('보강', () => {
        it('예산을 넘기면 기다리기를 그만두고 답을 내보낸다', async () => {
            mockAnalyzeNewsCards.mockReturnValue(deferred().promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(10_000);

            await expect(pending).resolves.toEqual({
                refreshed: true,
                changedCount: 2,
            });
        });

        it('예산 전에는 기다린다', async () => {
            mockAnalyzeNewsCards.mockReturnValue(deferred().promise);
            let settled = false;
            void ensureSymbolNewsFresh('LAES').then(() => {
                settled = true;
            });

            await vi.advanceTimersByTimeAsync(9_000);

            expect(settled).toBe(false);
        });

        /**
         * 이게 이 PR의 핵심 불변식이다. 무효화가 보강보다 먼저 나가면, 그 순간
         * 재생성된 ISR 스냅샷이 **미보강 상태로** TTL 내내 굳는다 — 고치려던
         * 실패가 그대로 재현된다.
         */
        it('버린 보강이 끝나기 전에는 무효화하지 않는다', async () => {
            const enrich = deferred<void>();
            mockAnalyzeNewsCards.mockReturnValue(enrich.promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(10_000);
            await pending;

            const flushed = flushAfter();
            await vi.advanceTimersByTimeAsync(0);
            expect(mockRevalidateTag).not.toHaveBeenCalled();

            enrich.resolve();
            await flushed;

            expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        });

        /** 버려도 계속 도는 호출이라, 다시 돌리면 같은 값을 두 번 지불한다. */
        it('넘어간 보강을 배경에서 다시 돌리지 않는다', async () => {
            const enrich = deferred<void>();
            mockAnalyzeNewsCards.mockReturnValue(enrich.promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(10_000);
            await pending;
            enrich.resolve();
            await flushAfter();

            expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
        });

        it('예산 안에 끝나면 타이머를 남기지 않는다', async () => {
            mockAnalyzeNewsCards.mockResolvedValue(undefined);

            await ensureSymbolNewsFresh('LAES');

            expect(vi.getTimerCount()).toBe(0);
        });

        it('예산을 넘겨도 타이머를 남기지 않는다', async () => {
            mockAnalyzeNewsCards.mockReturnValue(deferred().promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(10_000);
            await pending;

            expect(vi.getTimerCount()).toBe(0);
        });

        /**
         * 3단계가 다 있는 경우다 — 버린 동기 보강 → 남은 기사 배경 보강 →
         * 무효화. 이 순서가 이 PR의 불변식이고, 셋이 겹칠 때가 가장 깨지기 쉽다.
         */
        it('버린 보강 → 남은 기사 보강 → 무효화 순서를 지킨다', async () => {
            const seven = freshIngest(7);
            mockIngestNewsForSymbol.mockResolvedValue(seven);
            mockSelectUnanalyzed.mockReturnValue(seven.fresh);
            const sync = deferred<void>();
            mockAnalyzeNewsCards
                .mockReturnValueOnce(sync.promise)
                .mockResolvedValue(undefined);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(10_000);
            await pending;

            // 동기 몫만 불린 상태. 배경 몫은 아직이다.
            expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();

            const flushed = flushAfter();
            await vi.advanceTimersByTimeAsync(0);
            // 버린 보강이 안 끝났으면 남은 기사 보강도 무효화도 시작하면 안 된다.
            expect(mockAnalyzeNewsCards).toHaveBeenCalledOnce();
            expect(mockRevalidateTag).not.toHaveBeenCalled();

            sync.resolve();
            await flushed;

            expect(mockAnalyzeNewsCards).toHaveBeenCalledTimes(2);
            expect(mockAnalyzeNewsCards.mock.calls[1]![0]).toHaveLength(3);
            expect(mockAnalyzeNewsCards.mock.calls[1]![2]).toMatchObject({
                limit: 25,
                logLabel: 'chatNewsRefreshBackground',
            });
            expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        });
    });

    /**
     * 무효화는 공짜가 아니다 — 다음 방문자에게 Neon 조회와 전체 렌더를 물린다.
     * 인라인 경로는 `changedCount === 0`에서 단락해 그 비용을 안 내는데, 넘어간
     * 적재는 결과를 나중에 알므로 `after()` 안에서 **같은 판단을 다시** 해야 한다.
     */
    describe('넘어간 적재의 무효화 판단', () => {
        async function runDeferred(
            settle: (d: {
                resolve: (v: unknown) => void;
                reject: (e: unknown) => void;
            }) => void
        ): Promise<void> {
            let resolve!: (v: unknown) => void;
            let reject!: (e: unknown) => void;
            const promise = new Promise<unknown>((res, rej) => {
                resolve = res;
                reject = rej;
            });
            // 거절이 예산 만료 전에 미처리로 새지 않도록 소비자를 미리 붙인다.
            promise.catch(() => {});
            mockIngestNewsForSymbol.mockReturnValue(promise);

            const pending = ensureSymbolNewsFresh('LAES');
            await vi.advanceTimersByTimeAsync(8_000);
            await pending;

            settle({ resolve, reject });
            await flushAfter();
        }

        it('적재가 null(외부 fetch 실패)이면 무효화하지 않는다', async () => {
            await runDeferred(d => d.resolve(null));

            expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
            expect(mockRevalidateTag).not.toHaveBeenCalled();
        });

        it('바뀐 기사가 없으면 무효화하지 않는다', async () => {
            await runDeferred(d =>
                d.resolve({
                    fresh: [{ id: 'n0' }],
                    upsertSettled: [{ status: 'fulfilled', value: false }],
                })
            );

            expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
            expect(mockRevalidateTag).not.toHaveBeenCalled();
        });

        it('적재가 거절하면 무효화하지 않는다 — 뭐가 커밋됐는지 모른다', async () => {
            await runDeferred(d => d.reject(new Error('FMP down')));

            expect(mockRevalidateTag).not.toHaveBeenCalled();
        });

        it('선별 결과가 비면 보강 없이 무효화만 한다', async () => {
            mockSelectUnanalyzed.mockReturnValue([]);

            await runDeferred(d => d.resolve(freshIngest(2)));

            expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
            expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        });

        /** 보강이 실패해도 기사 원문은 커밋됐다 — 라벨 없이라도 노출돼야 한다. */
        it('보강이 실패해도 무효화는 한다', async () => {
            mockAnalyzeNewsCards.mockRejectedValue(new Error('LLM down'));

            await runDeferred(d => d.resolve(freshIngest(2)));

            expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
        });
    });
});
