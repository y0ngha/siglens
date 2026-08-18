import type { Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 retry 케이스의 실제
// 대기 시간을 없앤다. retry 발생 시 sleep이 호출되는 것만 검증.
// `vi.mock` 은 import 위로 호이스트되어야 static import 보다 먼저 평가된다
// (`import/first` 규칙과 일치).
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

// prewarmNews만 부분 목킹 대상 — runNewsAnalysis(core)는 대체하고 나머지는
// 실제 구현을 통과시켜 DrizzleNewsRepository 등 이 파일이 검증하는 실제
// 클래스와 충돌하지 않는다(같은 모듈이라 전체 목킹은 self-mock 문제를 만든다).
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

vi.mock('@/entities/earnings-report', () => ({
    getNextEarningsReport: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn(),
}));

// prewarmNews는 listBySymbol을 읽기 전에 ingestNewsForSymbol을 호출한다(SEO
// pre-warm news livelock 수정 — api.ts prewarmNews doc-comment 참고).
// ingestNewsForSymbol 자체(FMP fetch + upsert 조합)는 ingestNewsForSymbol.test.ts가
// 별도로 검증하므로, 여기서는 prewarmNews가 그 seam을 올바른 순서/fail-open으로
// 호출하는지만 확인하기 위해 mock한다.
vi.mock('../lib/ingestNewsForSymbol', async importOriginal => {
    // NewsIngestWriteError는 실제 클래스를 그대로 노출한다 — prewarmNews가
    // `instanceof`로 DB 장애를 구분하므로 가짜 클래스면 판별이 무의미해진다.
    const actual =
        await importOriginal<typeof import('../lib/ingestNewsForSymbol')>();
    return { ...actual, ingestNewsForSymbol: vi.fn() };
});

const { mockRevalidateTag } = vi.hoisted(() => ({
    mockRevalidateTag: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

// 카드 보강은 건당 LLM 왕복이라 여기서는 seam으로만 본다 — 어떤 후보가 어떤
// 상한으로 넘어가는지가 이 파일의 관심사이고, 보강 자체의 동작(정렬·상한·실패
// 격리)은 analyzeNewsCards.test.ts가 검증한다.
vi.mock('../lib/analyzeNewsCards', () => ({
    analyzeNewsCards: vi.fn().mockResolvedValue(undefined),
}));

import type {
    NewsCardAnalysis,
    NewsItem,
    RunNewsAnalysisResult,
    EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import { runNewsAnalysis, DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleNewsRepository,
    prewarmNews,
} from '@/entities/news-article/api';
import type { NewsRow } from '@/entities/news-article';
import { getDatabaseClient } from '@/shared/db/client';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';
import {
    ingestNewsForSymbol,
    NewsIngestWriteError,
} from '../lib/ingestNewsForSymbol';
import { analyzeNewsCards } from '../lib/analyzeNewsCards';
import { PREWARM_NEWS_CARD_LIMIT } from '../lib/newsAnalysisConstants';

const SEAM_SOURCE = readFileSync(
    fileURLToPath(new URL('../api.ts', import.meta.url)),
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

const analysis: NewsCardAnalysis = {
    titleKo: '애플 사상 최고가 달성',
    bodyKo: '주가가 신기록을 세웠다.',
    summaryKo: '애플 주가 신기록.',
    sentiment: 'bullish',
    category: 'other',
    priceImpact: 'medium',
};

// --- DB mock helpers ---

/**
 * Build a mock `db` that handles insert→values→onConflictDoUpdate→returning chains.
 * `returningRows` controls what `.returning()` resolves to, enabling boolean-return tests.
 */
interface UpsertDbMock {
    db: SiglensDatabase;
    insert: Mock;
    values: Mock;
    onConflictDoUpdate: Mock;
    returning: Mock;
}

function makeUpsertDb(
    returningRows: unknown[] = [{ id: 'abc123' }]
): UpsertDbMock {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
        returning,
    };
}

/** Build a mock `db` that handles update→set→where chains. */
function makeUpdateDb(): {
    db: SiglensDatabase;
    update: Mock;
    set: Mock;
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return {
        db: { update } as unknown as SiglensDatabase,
        update,
        set,
        where,
    };
}

/** Build a mock `db` for a select…where…orderBy chain returning `rows`. */
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

// --- Tests ---

describe('DrizzleNewsRepository', () => {
    describe('upsertNewsItem', () => {
        it('신규 삽입(returning 행 있음) 시 true를 반환한다', async () => {
            const { db } = makeUpsertDb([{ id: 'abc123' }]);
            const repo = new DrizzleNewsRepository(db);
            const result = await repo.upsertNewsItem(baseItem);
            expect(result).toBe(true);
        });

        it('동일 내용 재fetch(returning 빈 배열) 시 false를 반환한다', async () => {
            const { db } = makeUpsertDb([]);
            const repo = new DrizzleNewsRepository(db);
            const result = await repo.upsertNewsItem(baseItem);
            expect(result).toBe(false);
        });

        it('insert + onConflictDoUpdate + returning 체인을 호출한다', async () => {
            const { db, insert, values, onConflictDoUpdate, returning } =
                makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledTimes(1);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
            expect(returning).toHaveBeenCalledTimes(1);

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['id']).toBe('abc123');
            expect(row['symbol']).toBe('AAPL');
            expect(row['url']).toBe('https://example.com/news/1');
        });

        it('bodyEn 이 null 인 항목도 정상 삽입된다', async () => {
            const { db, values } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem({ ...baseItem, bodyEn: null });

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['bodyEn']).toBeNull();
        });

        it('conflict 경로에서 publishedAt도 갱신하고 setWhere를 포함한다', async () => {
            const { db, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            const conflictArg = onConflictDoUpdate.mock.calls[0][0] as {
                set: Record<string, unknown>;
                setWhere: unknown;
            };
            expect(conflictArg.set).toHaveProperty('publishedAt');
            // setWhere는 Drizzle `sql` 태그드 객체(`queryChunks` 보유)여야 한다 — 변경 여부 필터링용.
            // toBeDefined()만으론 setWhere 미전달과 빈 객체 차이를 잡지 못해 정밀 단언으로 보강.
            expect(conflictArg.setWhere).toEqual(
                expect.objectContaining({ queryChunks: expect.any(Array) })
            );
        });

        it('Neon transient 에러 발생 후 재시도해 성공하면 boolean을 반환한다', async () => {
            // 첫 chain은 returning에서 transient NeonDbError를 던지고,
            // 두 번째 chain은 성공해야 retry 정책이 의도대로 동작함을 보장한다.
            const neonTransient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const returning = vi
                .fn()
                .mockRejectedValueOnce(neonTransient)
                .mockResolvedValueOnce([{ id: 'abc123' }]);
            const onConflictDoUpdate = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            // transient 에러 후 retry → boolean(true) 반환
            await expect(repo.upsertNewsItem(baseItem)).resolves.toBe(true);

            // insert chain이 두 번 재구성됐는지 확인 — 동일 promise를 await 한 것이 아니라
            // 매 retry마다 새 query builder를 만들고 있다는 증거.
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다 (false가 아닌 reject)', async () => {
            // Constraint 위반 같은 영구 에러는 retry 해도 동일하게 실패할 뿐이므로
            // 첫 시도에서 즉시 throw 되어야 하며, false로 삼키면 안 된다.
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "news_pkey"'
                ),
                { name: 'NeonDbError' }
            );
            const returning = vi.fn().mockRejectedValueOnce(constraintError);
            const onConflictDoUpdate = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            await expect(repo.upsertNewsItem(baseItem)).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });

    describe('attachAnalysis', () => {
        it('update + set + where 를 호출한다', async () => {
            const { db, update, set, where } = makeUpdateDb();
            const repo = new DrizzleNewsRepository(db);
            const analyzedAt = new Date('2025-08-01T12:00:00.000Z');
            await repo.attachAnalysis('abc123', analysis, analyzedAt);

            expect(update).toHaveBeenCalledTimes(1);
            expect(set).toHaveBeenCalledTimes(1);
            expect(where).toHaveBeenCalledTimes(1);

            const setArg = set.mock.calls[0][0] as Record<string, unknown>;
            expect(setArg['titleKo']).toBe('애플 사상 최고가 달성');
            expect(setArg['sentiment']).toBe('bullish');
            expect(setArg['category']).toBe('other');
            expect(setArg['priceImpact']).toBe('medium');
            expect(setArg['analyzedAt']).toBe(analyzedAt);
        });
    });

    describe('listBySymbol', () => {
        interface DbRow {
            id: string;
            symbol: string;
            source: string;
            url: string;
            publishedAt: Date;
            titleEn: string;
            bodyEn: string | null;
            titleKo: string | null;
            bodyKo: string | null;
            summaryKo: string | null;
            sentiment: string | null;
            category: string | null;
            priceImpact: string | null;
            analyzedAt: Date | null;
        }

        const dbRow: DbRow = {
            id: 'abc123',
            symbol: 'AAPL',
            source: 'Reuters',
            url: 'https://example.com/news/1',
            publishedAt: new Date('2025-08-01T10:00:00.000Z'),
            titleEn: 'Apple hits all-time high',
            bodyEn: 'The stock reached a new record.',
            titleKo: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            analyzedAt: null,
        };

        it('publishedAt 을 ISO 문자열로 변환해 반환한다', async () => {
            const { db } = makeSelectDb([dbRow]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);

            expect(results).toHaveLength(1);
            expect(results[0]?.publishedAt).toBe('2025-08-01T10:00:00.000Z');
        });

        it('결과가 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeSelectDb([]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);
            expect(results).toEqual([]);
        });

        it('분석 완료 row 는 sentiment/category 를 포함한다', async () => {
            const analyzedRow: DbRow = {
                ...dbRow,
                titleKo: '애플 사상 최고가 달성',
                summaryKo: '애플 주가 신기록.',
                sentiment: 'bullish',
                category: 'other',
                priceImpact: 'medium',
                analyzedAt: new Date('2025-08-01T12:00:00.000Z'),
            };
            const { db } = makeSelectDb([analyzedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBe('bullish');
            expect(result.category).toBe('other');
            expect(result.titleKo).toBe('애플 사상 최고가 달성');
        });

        it('알 수 없는 enum 문자열은 null 로 정규화한다', async () => {
            // DB에 (수동 SQL 또는 스키마 변경 등으로) 등록되지 않은 값이 들어오면
            // 표시 단의 fallback이 처리할 수 있도록 read 시점에 null로 떨어뜨려야 한다.
            const corruptRow: DbRow = {
                ...dbRow,
                sentiment: 'unknown_value',
                category: 'unknown_category',
                priceImpact: 'unknown_impact',
            };
            const { db } = makeSelectDb([corruptRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });

        it('비문자열 enum 값은 null 로 정규화한다', async () => {
            // 타입 시스템 우회 또는 마이그레이션 사고로 비문자열이 들어와도
            // crash 없이 null로 강등시켜야 한다.
            const malformedRow = {
                ...dbRow,
                sentiment: 42,
                category: true,
                priceImpact: { broken: 'shape' },
            } as unknown as DbRow;
            const { db } = makeSelectDb([malformedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });
    });
});

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
                modelId: DEEPSEEK_V4_FLASH_MODEL,
                tier: 'free',
                reasoning: false,
                skipEnqueueIfMiss: false,
                assetClass: 'equity',
            })
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

    it('static guard: the seam source (api.ts) contains no request-context calls', () => {
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

    describe('ingest-before-read (SEO pre-warm news livelock fix)', () => {
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

        // 감사 F1 회귀 가드. cron이 DB를 채워도 news 목록 캐시(태그 `news:{SYMBOL}`,
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

        // 감사 F2 회귀 가드. DB 광역 장애를 fail-open으로 삼키면 비어 있는 DB를
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

            await expect(
                prewarmNews('AAPL', 'Apple Inc.', false)
            ).resolves.toEqual(SUBMITTED_RESULT);

            expect(mockRunNewsAnalysis).toHaveBeenCalledTimes(1);
            errorSpy.mockRestore();
        });

        // 감사 재검토 #2 회귀 가드. 2인자 호출로 되돌리면 180일 기본값이 살아나
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

        // 리뷰 지적(PR #700): resolveAssetClass()가 내부적으로 resolveMarketProfile()을
        // 호출하고 ingestNewsForSymbol도 profileId 없이 호출되면 다시 resolveMarketProfile을
        // 호출해, 심볼당 밤마다 getAssetInfo Redis 왕복이 중복됐다. prewarmNews는 이제
        // resolveMarketProfile을 한 번만 호출하고 그 결과를 ingestNewsForSymbol에 그대로
        // 전달해야 한다.
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
                    modelId: DEEPSEEK_V4_FLASH_MODEL,
                    tier: 'free',
                    reasoning: false,
                    skipEnqueueIfMiss: false,
                })
            );
        });
    });
});
