import type { Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 retry 케이스의 실제
// 대기 시간을 없앤다.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

// runNewsAnalysis(core)만 대체하고 나머지는 실제 구현을 통과시킨다.
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        runNewsAnalysis: vi.fn(),
    };
});

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(),
}));

vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsReport: vi.fn(),
}));

// 매크로 캘린더 헬퍼 — 호출처가 결과를 그대로 `macroCalendar`로 넘기는지 확인한다.
vi.mock('@/entities/economy/api/loadNewsMacroCalendar', () => ({
    loadNewsMacroCalendar: vi.fn(async () => [
        {
            date: '2026-09-30 18:00:00',
            event: 'Fed Interest Rate Decision',
            impact: 'High',
            actual: null,
            estimate: null,
            previous: null,
            unit: '%',
        },
    ]),
}));

vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn(),
}));

// prewarmNews는 listBySymbol을 읽기 전에 ingestNewsForSymbol을 호출한다.
// ingestNewsForSymbol 자체(FMP fetch + upsert 조합)는 ingestNewsForSymbol.test.ts가
// 별도로 검증하므로, 여기서는 prewarmNews가 그 seam을 올바른 순서/fail-open으로
// 호출하는지만 확인하기 위해 mock한다.
vi.mock('../../lib/ingestNewsForSymbol', async importOriginal => {
    // NewsIngestWriteError는 실제 클래스를 그대로 노출한다 — prewarmNews가
    // `instanceof`로 DB 장애를 구분하므로 가짜 클래스면 판별이 무의미해진다.
    const actual =
        await importOriginal<typeof import('../../lib/ingestNewsForSymbol')>();
    return { ...actual, ingestNewsForSymbol: vi.fn() };
});

const { mockRevalidateTag } = vi.hoisted(() => ({
    mockRevalidateTag: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

// 카드 보강은 건당 LLM 왕복이라 여기서는 seam으로만 본다 — 어떤 후보가 어떤
// 상한으로 넘어가는지가 이 파일의 관심사이고, 보강 자체의 동작(정렬·상한·실패
// 격리)은 analyzeNewsCards.test.ts가 검증한다.
vi.mock('../../lib/analyzeNewsCards', () => ({
    analyzeNewsCards: vi.fn().mockResolvedValue(undefined),
}));

import type {
    NewsItem,
    RunNewsAnalysisResult,
    EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import {
    runNewsAnalysis,
    DEEPSEEK_V4_1_FLASH_MODEL,
} from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { getDatabaseClient } from '@/shared/db/client';
import { getNextEarningsReport } from '@/entities/earnings-report/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../../lib/newsLookback';
import {
    ingestNewsForSymbol,
    NewsIngestWriteError,
} from '../../lib/ingestNewsForSymbol';
import { analyzeNewsCards } from '../../lib/analyzeNewsCards';
import { PREWARM_NEWS_CARD_LIMIT } from '../../lib/newsAnalysisConstants';
import { prewarmNews } from '../../server/prewarmNews';

const SEAM_SOURCE = readFileSync(
    fileURLToPath(new URL('../../server/prewarmNews.ts', import.meta.url)),
    'utf8'
);

const baseItem: NewsItem = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://example.com/news/1',
    publishedAt: '2025-08-01T10:00:00.000Z',
    titleEn: 'Apple hits all-time high',
    bodyEn: 'The stock reached a new record.',
};

function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: Mock;
    orderBy: Mock;
} {
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
    };
}

describe('prewarmNews', () => {
    const mockRunNewsAnalysis = vi.mocked(runNewsAnalysis);
    const mockGetDatabaseClient = vi.mocked(getDatabaseClient);
    const mockGetNextEarningsReport = vi.mocked(getNextEarningsReport);
    const mockResolveMarketProfile = vi.mocked(resolveMarketProfile);
    const mockIngestNewsForSymbol = vi.mocked(ingestNewsForSymbol);

    const ANALYZED_ROW = {
        id: 'abc123',
        symbol: 'AAPL',
        source: 'Reuters',
        url: 'https://reuters.com/aapl',
        publishedAt: new Date('2025-07-01T10:00:00.000Z'),
        titleEn: 'Apple earnings beat',
        bodyEn: 'Apple reported...',
        titleKo: '애플 실적 예상치 상회',
        bodyKo: '애플이 보고했다...',
        summaryKo: '긍정적 실적 발표',
        sentiment: 'bullish',
        priceImpact: 'medium',
        category: 'earnings',
        analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
    };

    const UNANALYZED_ROW = {
        ...ANALYZED_ROW,
        id: 'def456',
        titleKo: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        sentiment: null,
        category: null,
        analyzedAt: null,
    };

    const NEXT_EARNINGS: EarningsCalendarItem = {
        symbol: 'AAPL',
        earningsDate: '2025-08-01',
        epsActual: null,
        epsEstimated: 1.4,
        revenueActual: null,
        revenueEstimated: 88_000_000_000,
        lastUpdated: '2025-07-15',
    };

    const SUBMITTED_RESULT: RunNewsAnalysisResult = {
        status: 'done',
        result: { summary: 'news ok' } as never,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunNewsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        // 'us-equity' → getDescriptor('us-equity').assetClass === 'equity'
        // (실제 getDescriptor를 그대로 통과시켜 assetClass를 파생시킨다).
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetNextEarningsReport.mockResolvedValue(null);
        mockIngestNewsForSymbol.mockResolvedValue(null);
        const { db } = makeSelectDb([]);
        mockGetDatabaseClient.mockReturnValue({
            db,
        } as unknown as ReturnType<typeof getDatabaseClient>);
    });

    it('calls runNewsAnalysis with the anonymous-free branch shape', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                modelId: DEEPSEEK_V4_1_FLASH_MODEL,
                tier: 'free',
                reasoning: false,
                skipEnqueueIfMiss: false,
                assetClass: 'equity',
                currency: 'USD',
            })
        );
    });

    it('forwards currency: "KRW" when resolveMarketProfile resolves to kr-equity', async () => {
        mockResolveMarketProfile.mockResolvedValueOnce('kr-equity');

        await prewarmNews('005930.KS', '삼성전자', false);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'KRW' })
        );
    });

    it('threads force:true when requested', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', true);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        const callArg = mockRunNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });

    it('filters out unanalyzed rows (titleKo null) and threads enriched news', async () => {
        const { db } = makeSelectDb([ANALYZED_ROW, UNANALYZED_ROW]);
        mockGetDatabaseClient.mockReturnValue({
            db,
        } as unknown as ReturnType<typeof getDatabaseClient>);

        await prewarmNews('AAPL', 'Apple Inc.', false);

        const callArg = mockRunNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg?.news).toHaveLength(1);
    });

    it('includes upcomingCalendar when next earnings exist', async () => {
        mockGetNextEarningsReport.mockResolvedValueOnce(NEXT_EARNINGS);

        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [NEXT_EARNINGS] })
        );
    });

    it('upcomingCalendar is empty when there is no next earnings', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('passes the macro calendar helper result as macroCalendar', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                macroCalendar: [
                    expect.objectContaining({
                        event: 'Fed Interest Rate Decision',
                    }),
                ],
            })
        );
    });

    it('static guard: the seam source (server/prewarmNews.ts) contains no request-context calls', () => {
        expect(SEAM_SOURCE).not.toMatch(
            /next\/headers|getCurrentUser|isBot|cookies|draftMode/
        );
    });

    /**
     * 프로덕션 회귀 가드 (2026-08-18). prewarm은 기사를 적재만 하고 카드 보강을
     * 건너뛰었다. `isEnrichedRow`가 미보강 행을 전부 걸러내므로 core는 매번
     * `{status:'error', code:'no_news'}`를 돌려줬고, `news`·`overall` 두 탭
     * 스냅샷이 **한 건도** 생성되지 않았다. 보강이 방문자 경로에만 있었기 때문에
     * 사람이 찾지 않는 종목은 영원히 그 상태였다(국내 20종목 전부 / 미국
     * 저유동성 종목·알트코인 동일).
     */
    describe('카드 보강 (thin 스냅샷 회귀 가드)', () => {
        const mockAnalyzeNewsCards = vi.mocked(analyzeNewsCards);

        it('미보강 기사를 분석 전에 보강한다', async () => {
            const { db } = makeSelectDb([UNANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{ ...baseItem, id: UNANALYZED_ROW.id }],
                upsertSettled: [{ status: 'fulfilled', value: true }],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockAnalyzeNewsCards).toHaveBeenCalledTimes(1);
            const [candidates, , options] = mockAnalyzeNewsCards.mock.calls[0]!;
            expect(candidates.map(c => c.id)).toEqual([UNANALYZED_ROW.id]);
            // 유닛 타임아웃(2분) 안에 보강 + 집계 분석을 모두 끝내야 한다.
            expect(options.limit).toBe(PREWARM_NEWS_CARD_LIMIT);
        });

        it('이미 보강된 기사는 다시 분석하지 않는다', async () => {
            const { db } = makeSelectDb([ANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{ ...baseItem, id: ANALYZED_ROW.id }],
                upsertSettled: [{ status: 'fulfilled', value: true }],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
        });

        it('보강한 뒤 DB를 다시 읽어 그 결과를 분석에 넘긴다', async () => {
            // 재조회가 없으면 보강 비용만 쓰고 여전히 빈 입력으로 분석을 부른다 —
            // 겉보기엔 "보강했는데도 안 된다"로 보이는 가장 지독한 실패 모드다.
            const { db, orderBy } = makeSelectDb([]);
            orderBy
                .mockResolvedValueOnce([UNANALYZED_ROW])
                .mockResolvedValueOnce([ANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{ ...baseItem, id: UNANALYZED_ROW.id }],
                upsertSettled: [{ status: 'fulfilled', value: true }],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(orderBy).toHaveBeenCalledTimes(2);
            expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({
                    news: expect.arrayContaining([
                        expect.objectContaining({ id: ANALYZED_ROW.id }),
                    ]),
                })
            );
        });

        it('보강 대상이 없으면 DB를 두 번 읽지 않는다', async () => {
            const { db, orderBy } = makeSelectDb([ANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{ ...baseItem, id: ANALYZED_ROW.id }],
                upsertSettled: [{ status: 'fulfilled', value: true }],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(orderBy).toHaveBeenCalledTimes(1);
        });

        it('upsert가 실패해 DB에 없는 기사는 후보에서 뺀다', async () => {
            // 적재는 과반 미만 실패를 삼키고 진행한다. 그런 항목까지 분석하면
            // LLM 비용만 쓰고 `attachAnalysis`는 없는 id에 no-op update를 한다.
            const { db } = makeSelectDb([UNANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [
                    { ...baseItem, id: UNANALYZED_ROW.id },
                    { ...baseItem, id: 'upsert-failed' },
                ],
                upsertSettled: [
                    { status: 'fulfilled', value: true },
                    { status: 'rejected', reason: new Error('write failed') },
                ],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            const [candidates] = mockAnalyzeNewsCards.mock.calls[0]!;
            expect(candidates.map(c => c.id)).toEqual([UNANALYZED_ROW.id]);
        });

        it('적재가 실패하면(fail-open) 보강을 건너뛴다', async () => {
            const { db } = makeSelectDb([UNANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce(null);

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockAnalyzeNewsCards).not.toHaveBeenCalled();
        });
    });

    describe('ingest-before-read', () => {
        it('calls ingestNewsForSymbol before reading listBySymbol from DB', async () => {
            const callOrder: string[] = [];
            const { db, orderBy } = makeSelectDb([]);
            orderBy.mockImplementation(() => {
                callOrder.push('listBySymbol');
                return Promise.resolve([]);
            });
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockImplementationOnce(async () => {
                callOrder.push('ingestNewsForSymbol');
                return null;
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(callOrder).toEqual(['ingestNewsForSymbol', 'listBySymbol']);
        });

        // 회귀 가드. cron이 DB를 채워도 news 목록 캐시(태그 `news:{SYMBOL}`,
        // 12h)를 무효화하지 않으면 Fix B의 최대 성과가 최대 12시간 노출되지 않는다.
        it('새로 적재된 기사가 있으면 news 태그를 무효화한다', async () => {
            const { db } = makeSelectDb([]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{}, {}] as unknown as NewsItem[],
                upsertSettled: [
                    { status: 'fulfilled', value: true },
                    { status: 'fulfilled', value: false },
                ],
            });

            await prewarmNews('aapl', 'Apple Inc.', false);

            expect(mockRevalidateTag).toHaveBeenCalledWith('news:AAPL', 'max');
        });

        it('변경된 기사가 없으면 무효화하지 않는다(무효화 폭풍 방지)', async () => {
            const { db } = makeSelectDb([]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce({
                fresh: [{}] as unknown as NewsItem[],
                upsertSettled: [{ status: 'fulfilled', value: false }],
            });

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockRevalidateTag).not.toHaveBeenCalled();
        });

        // 회귀 가드. DB 광역 장애를 fail-open으로 삼키면 비어 있는 DB를
        // 그대로 분석해 빈약한 스냅샷이 generatedAt=now로 굳어, 다음 거래일
        // 경계까지 재시도조차 되지 않는다.
        it('DB 쓰기 장애(NewsIngestWriteError)는 삼키지 않고 올려보낸다', async () => {
            mockIngestNewsForSymbol.mockRejectedValueOnce(
                new NewsIngestWriteError(9, 10)
            );

            await expect(
                prewarmNews('AAPL', 'Apple Inc.', false)
            ).rejects.toBeInstanceOf(NewsIngestWriteError);
        });

        it('ingest 실패(reject)해도 fail-open으로 DB의 기존 뉴스로 분석을 계속 진행한다', async () => {
            mockIngestNewsForSymbol.mockRejectedValueOnce(
                new Error('FMP outage')
            );
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const { db } = makeSelectDb([ANALYZED_ROW]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);

            // 적재는 fail-open이라 분석은 그대로 진행되지만, **왜 DB가 비었는지**를
            // 호출부가 알아야 한다 — `resolveHarvest`가 "30일간 뉴스 없음"(24h
            // backoff)과 "오늘 못 가져옴"(30분 티어)을 여기서만 구분할 수 있다.
            await expect(
                prewarmNews('AAPL', 'Apple Inc.', false)
            ).resolves.toEqual({ ...SUBMITTED_RESULT, newsFetchFailed: true });

            expect(mockRunNewsAnalysis).toHaveBeenCalledTimes(1);
            errorSpy.mockRestore();
        });

        it('적재가 성공하면 newsFetchFailed를 붙이지 않는다', async () => {
            mockIngestNewsForSymbol.mockResolvedValue({
                fresh: [],
                upsertSettled: [],
            });

            await expect(
                prewarmNews('AAPL', 'Apple Inc.', false)
            ).resolves.not.toHaveProperty('newsFetchFailed');
        });

        // 회귀 가드. 2인자 호출로 되돌리면 180일 기본값이 살아나
        // 295심볼 × 최대 1000건을 매일 밤 Neon에 쓰게 된다(읽는 건 30일치뿐).
        it('cron 경로는 분석 창(30일) lookback으로 적재한다', async () => {
            const { db } = makeSelectDb([]);
            mockGetDatabaseClient.mockReturnValue({
                db,
            } as unknown as ReturnType<typeof getDatabaseClient>);
            mockIngestNewsForSymbol.mockResolvedValueOnce(null);

            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockIngestNewsForSymbol).toHaveBeenCalledWith(
                'AAPL',
                expect.anything(),
                NEWS_ANALYSIS_LOOKBACK_MS,
                'us-equity'
            );
        });

        // ingestNewsForSymbol이 profileId 없이 호출되면 resolveMarketProfile을 다시
        // 호출해 심볼당 밤마다 getAssetInfo Redis 왕복이 중복된다. prewarmNews는
        // resolveMarketProfile을 한 번만 호출하고 그 결과를 그대로 전달해야 한다.
        it('resolveMarketProfile을 정확히 1회만 호출하고 그 결과를 ingestNewsForSymbol에 전달한다', async () => {
            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockResolveMarketProfile).toHaveBeenCalledTimes(1);
            expect(mockResolveMarketProfile).toHaveBeenCalledWith('AAPL');
            expect(mockIngestNewsForSymbol).toHaveBeenCalledWith(
                'AAPL',
                expect.anything(),
                expect.anything(),
                'us-equity'
            );
        });

        it('submit 페이로드(model/tier/reasoning)는 ingest 도입 전과 동일하다', async () => {
            await prewarmNews('AAPL', 'Apple Inc.', false);

            expect(mockRunNewsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: DEEPSEEK_V4_1_FLASH_MODEL,
                    tier: 'free',
                    reasoning: false,
                    skipEnqueueIfMiss: false,
                })
            );
        });
    });
});
