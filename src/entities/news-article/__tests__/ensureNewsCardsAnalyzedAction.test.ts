// action은 fresh upsert 후 revalidateTag로 news ISR 캐시를 무효화한다. 테스트 환경엔
// Next.js 런타임이 없으므로 next/cache를 mock해 호출만 관측한다(실제 revalidate는 no-op).
const revalidateTagSpy = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({
    revalidateTag: revalidateTagSpy,
}));

vi.mock('../lib/newsRefreshFlag', () => ({
    isRecentlyFetched: vi.fn(),
    markFetched: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitNewsCardAnalysis: vi.fn(),
    pollNewsCardAnalysis: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/api/e2eEnv', () => ({
    isE2E: vi.fn(),
}));

// The action resolves its client through the getNewsClient factory (FMP in
// prod, fake under E2E_TEST). We mock the factory directly so each test injects
// a fresh client without fighting the factory's module-level singleton cache.
vi.mock('../lib/getNewsClient', () => ({
    getNewsClient: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

// getAssetInfo is called by ensureNewsCardsAnalyzedAction (via resolveMarketProfile) to resolve
// news source per asset. Default to equity (no marketProfile) so existing tests are unaffected.
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn().mockResolvedValue({ symbol: 'AAPL', name: 'Apple' }),
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return {
            upsertNewsItem: vi.fn(),
            attachAnalysis: vi.fn(),
            listBySymbol: vi.fn().mockResolvedValue([]),
        };
    }),
}));

import type { MockedFunction, MockedClass, Mock } from 'vitest';
import { ensureNewsCardsAnalyzedAction } from '../actions/ensureNewsCardsAnalyzedAction';
import {
    DISABLED_THINKING_BUDGET,
    POLL_MAX_ATTEMPTS,
} from '../lib/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import {
    submitNewsCardAnalysis,
    pollNewsCardAnalysis,
} from '@y0ngha/siglens-core';
import { getNewsClient } from '../lib/getNewsClient';
import { isE2E } from '@/shared/api/e2eEnv';
import type {
    NewsItem,
    NewsCardAnalysis,
    SubmitNewsCardAnalysisResult,
    PollNewsCardAnalysisResult,
} from '@y0ngha/siglens-core';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { isRecentlyFetched, markFetched } from '../lib/newsRefreshFlag';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';

const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockIsRecentlyFetched = isRecentlyFetched as Mock;
const mockMarkFetched = markFetched as Mock;
const mockGetNewsClient = getNewsClient as Mock;
const mockIsE2E = isE2E as MockedFunction<typeof isE2E>;
const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;

const mockSubmitNewsCardAnalysis = submitNewsCardAnalysis as MockedFunction<
    typeof submitNewsCardAnalysis
>;

const mockPollNewsCardAnalysis = pollNewsCardAnalysis as MockedFunction<
    typeof pollNewsCardAnalysis
>;

const NEWS_ITEM_1: NewsItem = {
    id: 'item-001',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl-1',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple Q3 earnings beat',
    bodyEn: 'Apple reported strong Q3 results...',
};

const NEWS_ITEM_2: NewsItem = {
    id: 'item-002',
    symbol: 'AAPL',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/aapl-2',
    publishedAt: '2025-07-02T12:00:00.000Z',
    titleEn: 'Apple launches new iPhone',
    bodyEn: 'Apple announced the new iPhone...',
};

const CARD_ANALYSIS: NewsCardAnalysis = {
    titleKo: '애플 Q3 실적 예상치 상회',
    bodyKo: null,
    summaryKo: '긍정적 실적 발표',
    sentiment: 'bullish',
    category: 'earnings',
    priceImpact: 'high',
};

const SUBMITTED_RESULT: SubmitNewsCardAnalysisResult = {
    status: 'submitted',
    jobId: 'job-card-001',
};

const POLL_DONE: PollNewsCardAnalysisResult = {
    status: 'done',
    result: CARD_ANALYSIS,
};

const POLL_ERROR: PollNewsCardAnalysisResult = {
    status: 'error',
    error: 'LLM worker failed',
};

describe('ensureNewsCardsAnalyzedAction 함수는', () => {
    let mockFetchNewsForPeriod: Mock;
    let mockUpsertNewsItem: Mock;
    let mockAttachAnalysis: Mock;
    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitNewsCardAnalysis.mockReset();
        mockPollNewsCardAnalysis.mockReset();
        mockIsRecentlyFetched.mockResolvedValue(false);
        mockMarkFetched.mockResolvedValue(undefined);
        mockIsE2E.mockReturnValue(false);

        mockFetchNewsForPeriod = vi.fn();
        // upsertNewsItem은 Task 4에서 Promise<boolean>으로 변경됨:
        // true = 신규 삽입 또는 내용 변경, false = no-op(동일 기사 재fetch).
        // 기본값 true: 기존 테스트 대부분이 "변경 있음" 시나리오를 검증하므로.
        mockUpsertNewsItem = vi.fn().mockResolvedValue(true);
        mockAttachAnalysis = vi.fn().mockResolvedValue(undefined);
        mockListBySymbol = vi.fn().mockResolvedValue([]);

        mockGetNewsClient.mockReturnValue({
            fetchNewsForPeriod: mockFetchNewsForPeriod,
        });
        MockNewsRepository.mockImplementation(function () {
            return {
                upsertNewsItem: mockUpsertNewsItem,
                attachAnalysis: mockAttachAnalysis,
                listBySymbol: mockListBySymbol,
            } as never;
        });
    });

    describe('정상 흐름에서', () => {
        it('FMP에서 6개월치 뉴스를 가져온다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
        });

        it('각 뉴스 아이템을 DB에 upsert한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });

        it('각 뉴스 아이템에 대해 submitNewsCardAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
                item: NEWS_ITEM_1,
                thinkingBudget: DISABLED_THINKING_BUDGET,
            });
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith({
                item: NEWS_ITEM_2,
                thinkingBudget: DISABLED_THINKING_BUDGET,
            });
        });

        it('뉴스가 없으면 upsert와 카드 분석을 호출하지 않는다', async () => {
            // if (fresh.length === 0) return으로 early return —
            // changedCount/revalidateTag/analyze 단계에 도달하지 않음.
            // unanalyzed가 fresh.filter(...)로 파생되므로 fresh=[]이면 analyze는 항상 no-op이라 안전.
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('fresh 뉴스 upsert 후 news ISR 캐시를 대문자 태그로 revalidateTag한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            // 소문자 입력 → 태그는 대문자 정규화(news:AAPL), profile은 'max'.
            await ensureNewsCardsAnalyzedAction('aapl');

            expect(revalidateTagSpy).toHaveBeenCalledWith('news:AAPL', 'max');
        });

        // fresh.length === 0 시나리오는 아래 'revalidateTag 게이팅은' describe의
        // 'empty-fresh' 케이스에서 markFetched 단언까지 함께 검증한다.
        it('모든 upsert가 false(no-op)이면 revalidateTag를 호출하지 않는다', async () => {
            // 같은 기사 재fetch: DB에 변경 없음 → changedCount=0 → 스킵.
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem.mockResolvedValue(false);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(revalidateTagSpy).not.toHaveBeenCalled();
            // markFetched는 changedCount 게이트와 무관하게 항상 호출된다.
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });
    });

    describe('revalidateTag 게이팅은', () => {
        // no-change(모든 upsert=false → revalidateTag 미호출 + markFetched 호출)는
        // 위 describe의 "모든 upsert가 false(no-op)" 케이스에서 검증.
        it('some-change: 1건 이상 true → revalidateTag 1회 호출(news:AAPL, max)', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockResolvedValueOnce(false) // NEWS_ITEM_1: no-op
                .mockResolvedValueOnce(true); // NEWS_ITEM_2: 새 기사
            // changedCount=1 → revalidateTag 호출.

            await ensureNewsCardsAnalyzedAction('aapl');

            expect(revalidateTagSpy).toHaveBeenCalledTimes(1);
            expect(revalidateTagSpy).toHaveBeenCalledWith('news:AAPL', 'max');
        });

        it('partial-failure(minority) + 1건 true → revalidateTag 호출', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB constraint')) // reject: minority
                .mockResolvedValueOnce(true); // fulfilled true
            // upsertFailures.length=1 ≤ 2/2(=1), 과반 미달 → throw 안 함.
            // changedCount=1 → revalidateTag 호출.
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(revalidateTagSpy).toHaveBeenCalledWith('news:AAPL', 'max');
        });

        it('partial-failure(minority) + 모두 false → revalidateTag 미호출', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB constraint')) // reject: minority
                .mockResolvedValueOnce(false); // fulfilled false → changedCount=0
            // upsertFailures.length=1 ≤ 1(=2/2), 과반 미달.
            // changedCount=0 → revalidateTag 미호출.

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(revalidateTagSpy).not.toHaveBeenCalled();
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });

        it('majority-failure: 과반 reject → throw, revalidateTag 미도달', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
                'majority upsert failure'
            );

            expect(revalidateTagSpy).not.toHaveBeenCalled();
        });

        it('empty-fresh: upsertSettled 비어 changedCount=0 → markFetched 호출, revalidateTag 미호출', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
            expect(revalidateTagSpy).not.toHaveBeenCalled();
        });

        it('fresh.length === 0 early-return은 DB에 미분석 기사가 있어도 안전하다', async () => {
            // fresh=[]이면 unanalyzed는 항상 빈 배열이 된다(unanalyzed = fresh.filter(...)).
            // 따라서 listBySymbol로 DB를 조회할 필요가 없고, submitNewsCardAnalysis도
            // 호출할 필요가 없다 — 분석 대상이 fresh에서 파생되므로 fresh가 비면 항상 빈다.
            // DB에 analyzedAt=null 행이 남아 있더라도 이번 호출에서 가져온 fresh가 없으면
            // 그 행을 참조할 방법이 없으므로 early-return은 안전하다.
            mockFetchNewsForPeriod.mockResolvedValue([]);
            // DB에 미분석 기사가 있다고 가정한다(next call에서 구제됨).
            mockListBySymbol.mockResolvedValue([
                { id: 'stale-item-001', analyzedAt: null },
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockListBySymbol).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('[회귀] changedCount=0이어도 analyzedAt=null 기존 기사가 있으면 분석 단계를 실행한다', async () => {
            // 시나리오: 이전 호출에서 분석 워커가 실패해 NEWS_ITEM_1이 DB에 upsert되었지만
            // analyzedAt=null로 남아 있다. 이번 fetch에서 같은 기사가 재fetch되어
            // upsertNewsItem → false(no-op). changedCount=0이지만 listBySymbol이 반환한
            // 행의 analyzedAt=null → 분석 단계를 건너뛰면 그 기사는 영구적으로 미분석 상태가 된다.
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            // 모든 upsert가 false → changedCount=0 (재fetch, 내용 동일)
            mockUpsertNewsItem.mockResolvedValue(false);
            // DB에는 해당 기사가 있으나 아직 분석 안 됨(analyzedAt=null)
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: null },
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            // revalidateTag는 changedCount=0이므로 호출되지 않아야 한다.
            expect(revalidateTagSpy).not.toHaveBeenCalled();
            // 그러나 분석 단계는 반드시 실행되어야 한다 — 미분석 기사를 구제해야 하므로.
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_1 })
            );
            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });

        it('[회귀] changedCount=0이고 미분석 기사도 없으면 분석 단계를 호출하지 않는다', async () => {
            // changedCount=0이지만 listBySymbol이 모든 기사가 이미 분석 완료 상태임을 반환.
            // 분석 단계는 unanalyzed=[]이므로 실제 submit 호출이 없어야 한다.
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockUpsertNewsItem.mockResolvedValue(false);
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: new Date('2025-07-01') },
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(revalidateTagSpy).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('submitted 결과는', () => {
        it('pollNewsCardAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockPollNewsCardAnalysis).toHaveBeenCalledWith(
                SUBMITTED_RESULT.jobId
            );
        });

        it('poll 완료(done) 시 attachAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });

        it('poll 에러(error) 시 attachAnalysis를 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_ERROR);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).not.toHaveBeenCalled();
        });

        it('processing 후 done이 되면 attachAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockPollNewsCardAnalysis).toHaveBeenCalledTimes(3);
            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });
    });

    describe('오류 처리에서', () => {
        it('FMP fetch 실패 시 reject하지 않고 조용히 리턴한다', async () => {
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP network error')
            );

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
        });

        it('FMP 429 fetch 실패 시 서버 로그를 남기지 않고 조용히 리턴한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockRejectedValue(
                new Error('FMP news/stock 429')
            );

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('upsert 실패해도 모든 아이템의 카드 분석을 시도한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB constraint error'))
                .mockResolvedValueOnce(true); // NEWS_ITEM_2는 실제 변경
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
        });

        it('upsert 과반 실패 시 에러를 throw한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            // Both upserts fail → 2/2 > 50%, triggers majority-failure throw.
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
                'majority upsert failure'
            );

            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('카드 분석 실패 시 reject하지 않고 계속 진행한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockSubmitNewsCardAnalysis
                .mockRejectedValueOnce(new Error('LLM timeout'))
                .mockResolvedValueOnce(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(2);
            expect(mockAttachAnalysis).toHaveBeenCalledTimes(1);
        });
    });

    describe('DB-first 필터링은', () => {
        it('모든 아이템이 이미 분석 완료(analyzedAt != null)이면 카드 분석을 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: new Date('2025-07-01') },
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockListBySymbol).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('분석 완료된 아이템은 건너뛰고 미분석 아이템만 카드 분석을 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: new Date('2025-07-01') },
                { id: NEWS_ITEM_2.id, analyzedAt: null },
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_2 })
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_1 })
            );
        });

        it('listBySymbol 실패 시 에러를 전파한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockListBySymbol.mockRejectedValue(new Error('DB connection lost'));

            await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
                'DB connection lost'
            );
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('skipAnalysis 옵션은', () => {
        it('true이면 FMP fetch와 DB upsert는 수행하지만 LLM 분석은 건너뛴다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: true,
            });

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockListBySymbol).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('false이면 기존과 동일하게 LLM 분석까지 수행한다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: false,
            });

            expect(mockSubmitNewsCardAnalysis).toHaveBeenCalledTimes(1);
            // markFetched must fire on the human path too (it sits before the
            // skipAnalysis short-circuit). Guards against regressions that move
            // the call into the bot-only branch.
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });
    });

    describe('E2E 모드에서는', () => {
        it('FMP fetch와 DB upsert는 수행하지만 카드 worker 분석은 건너뛴다', async () => {
            mockIsE2E.mockReturnValue(true);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
            expect(mockListBySymbol).not.toHaveBeenCalled();
            expect(mockSubmitNewsCardAnalysis).not.toHaveBeenCalled();
            expect(mockPollNewsCardAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('poll 타임아웃은', () => {
        it(`POLL_MAX_ATTEMPTS(${POLL_MAX_ATTEMPTS})번 모두 processing이면 console.warn을 호출하고 attachAnalysis는 호출하지 않는다`, async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);

            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockUpsertNewsItem.mockResolvedValue(true); // 변경 있음 → revalidateTag 통과
            mockListBySymbol.mockResolvedValue([
                { id: NEWS_ITEM_1.id, analyzedAt: null },
            ]);
            mockSubmitNewsCardAnalysis.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-1',
            } satisfies SubmitNewsCardAnalysisResult);
            // Always returns 'processing' — worker never finishes.
            mockPollNewsCardAnalysis.mockResolvedValue({
                status: 'processing',
            });

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(warnSpy).toHaveBeenCalled();
            expect(mockPollNewsCardAnalysis).toHaveBeenCalledTimes(
                POLL_MAX_ATTEMPTS
            );
            expect(mockAttachAnalysis).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });

    describe('뉴스 소스 분기는', () => {
        it('equity 심볼(marketProfile 없음)은 getNewsClient를 "stock"으로 호출한다', async () => {
            // Default mock already returns { symbol: 'AAPL', name: 'Apple' } (no marketProfile).
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockGetNewsClient).toHaveBeenCalledWith('stock');
        });

        it('crypto 심볼(marketProfile: "crypto")은 getNewsClient를 "crypto"로 호출한다', async () => {
            mockGetAssetInfo.mockResolvedValueOnce({
                symbol: 'BTCUSD',
                name: 'Bitcoin',
                marketProfile: 'crypto',
            });
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('BTCUSD');

            expect(mockGetNewsClient).toHaveBeenCalledWith('crypto');
        });
    });

    describe('봇 경로 refresh 가드는', () => {
        it('봇 + 최근 fetch됨 → FMP fetch와 DB upsert를 스킵한다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(true);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: true,
            });

            expect(mockFetchNewsForPeriod).not.toHaveBeenCalled();
            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
        });

        it('봇 + 미fetch → fetch + upsert + markFetched 호출', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: true,
            });

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(1);
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });

        it('봇 경로 + 뉴스 없음(fresh=[]) → markFetched는 여전히 호출된다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([]);
            await ensureNewsCardsAnalyzedAction('AAPL', { skipAnalysis: true });
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });

        it('사람 경로 → 최근 fetch됐어도 항상 fetch한다(가드 무시)', async () => {
            mockIsRecentlyFetched.mockResolvedValue(true);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockSubmitNewsCardAnalysis.mockResolvedValue(SUBMITTED_RESULT);
            mockPollNewsCardAnalysis.mockResolvedValue(POLL_DONE);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
        });

        it('upsert 과반 실패 시 markFetched를 호출하지 않는다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            // Both upserts fail → majority failure → action throws before markFetched.
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL', { skipAnalysis: true })
            ).rejects.toThrow('majority upsert failure');

            expect(mockMarkFetched).not.toHaveBeenCalled();
        });
    });
});
