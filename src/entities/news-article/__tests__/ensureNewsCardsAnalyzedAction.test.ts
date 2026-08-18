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
    runNewsCardAnalysis: vi.fn(),
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
import { NEWS_CARD_ANALYSIS_PARALLEL_LIMIT } from '../lib/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { runNewsCardAnalysis } from '@y0ngha/siglens-core';
import { VISITOR_NEWS_CARD_LIMIT } from '../lib/newsAnalysisConstants';
import { getNewsClient } from '../lib/getNewsClient';
import { isE2E } from '@/shared/api/e2eEnv';
import type {
    NewsItem,
    NewsCardAnalysis,
    RunNewsCardAnalysisResult,
} from '@y0ngha/siglens-core';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { isRecentlyFetched, markFetched } from '../lib/newsRefreshFlag';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { NewsIngestWriteError } from '../lib/ingestNewsForSymbol';

const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockIsRecentlyFetched = isRecentlyFetched as Mock;
const mockMarkFetched = markFetched as Mock;
const mockGetNewsClient = getNewsClient as Mock;
const mockIsE2E = isE2E as MockedFunction<typeof isE2E>;
const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;

const mockRunNewsCardAnalysis = runNewsCardAnalysis as MockedFunction<
    typeof runNewsCardAnalysis
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

const DONE_RESULT: RunNewsCardAnalysisResult = {
    status: 'done',
    result: CARD_ANALYSIS,
};

describe('ensureNewsCardsAnalyzedAction 함수는', () => {
    let mockFetchNewsForPeriod: Mock;
    let mockUpsertNewsItem: Mock;
    let mockAttachAnalysis: Mock;
    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRunNewsCardAnalysis.mockReset();
        mockRunNewsCardAnalysis.mockReset();
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
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockFetchNewsForPeriod).toHaveBeenCalledWith(
                'AAPL',
                NEWS_LOOKBACK_MS
            );
        });

        it('titleKo·summaryKo가 모두 빈 결과는 persist하지 않는다 — write-once 고착 방지', async () => {
            // core normalizer는 응답이 스키마와 어긋나면 crash-safe fallback으로
            // 모든 문자열 필드를 ''로 떨어뜨린다. 그대로 attachAnalysis하면
            // analyzedAt이 세팅되어 이 기사는 영구히 재분석 대상에서 빠지고
            // sentiment='neutral'/category='other'로 굳는다. DeepSeek 어댑터는
            // responseSchema를 무시하므로(json_object만 강제) 이 경로가 실제로
            // 열려 있다 — 경제 이벤트 경로와 동일하게 skip해야 한다.
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue({
                status: 'done',
                result: { ...CARD_ANALYSIS, titleKo: '  ', summaryKo: '   ' },
            });

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockAttachAnalysis).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('empty card analysis')
            );

            warnSpy.mockRestore();
        });

        it('titleKo가 채워져 있으면 summaryKo가 비어도 persist한다', async () => {
            // 이 경로에는 TTL 게이트가 없어(사람은 항상 fresh) analyzedAt이 null로
            // 남으면 FMP lookback 동안 방문마다 재분석된다. titleKo가 있는 응답은
            // normalizer fallback이 아니라 모델이 실제로 만든 결과이므로 저장해
            // 그 재시도 루프에 들어가지 않게 한다 — 가드를 "둘 다 빈 경우"로 좁힌 이유.
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue({
                status: 'done',
                result: { ...CARD_ANALYSIS, summaryKo: '   ' },
            });

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).toHaveBeenCalledTimes(1);
        });

        it('각 뉴스 아이템을 DB에 upsert한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(2);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_1);
            expect(mockUpsertNewsItem).toHaveBeenCalledWith(NEWS_ITEM_2);
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });

        it('한 번에 보강하는 기사 수를 VISITOR_NEWS_CARD_LIMIT로 묶는다', async () => {
            // 적재 lookback이 180일이고 FMP 상한이 1,000건이라, 상한이 없으면
            // 백로그가 쌓인 종목의 첫 마운트 한 번이 최악 1,000회 LLM 왕복이 된다.
            // 2-vCPU 박스에서 LLM 소켓 4개를 수십 분 잡는다(감사: 비용 확인 패스).
            const many = Array.from({ length: 40 }, (_, i) => ({
                ...NEWS_ITEM_1,
                id: `news-${i}`,
                url: `https://example.com/${i}`,
            }));
            mockFetchNewsForPeriod.mockResolvedValue(many);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(
                VISITOR_NEWS_CARD_LIMIT
            );
            // 적재는 전량 그대로다 — 상한은 분석 단계에만 건다.
            expect(mockUpsertNewsItem).toHaveBeenCalledTimes(40);
        });

        it('각 뉴스 아이템에 대해 runNewsCardAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(2);
            // 정확 일치로 단언한다 — 추론 스위치를 호출부로 되돌리려는 시도
            // (`thinkingBudget`/`reasoning` 재추가)를 여기서 잡는다. 그 정책은
            // core의 `runNewsCardAnalysis`가 `reasoning: false`로 고정한다.
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledWith({
                item: NEWS_ITEM_1,
            });
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledWith({
                item: NEWS_ITEM_2,
            });
        });

        it('뉴스가 없으면 upsert와 카드 분석을 호출하지 않는다', async () => {
            // if (fresh.length === 0) return으로 early return —
            // changedCount/revalidateTag/analyze 단계에 도달하지 않음.
            // unanalyzed가 fresh.filter(...)로 파생되므로 fresh=[]이면 analyze는 항상 no-op이라 안전.
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('fresh 뉴스 upsert 후 news ISR 캐시를 대문자 태그로 revalidateTag한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

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
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

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

        // fire-and-forget 계약(파일 docstring, MISTAKES.md "Fire-and-Forget
        // Operations §2") — NewsIngestWriteError는 throw하지 않고 삼킨다(PR #700 리뷰).
        it('majority-failure: 과반 reject → throw하지 않고 삼키며, revalidateTag 미도달', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(revalidateTagSpy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('empty-fresh: upsertSettled 비어 changedCount=0 → markFetched 호출, revalidateTag 미호출', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([]);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
            expect(revalidateTagSpy).not.toHaveBeenCalled();
        });

        it('fresh.length === 0 early-return은 DB에 미분석 기사가 있어도 안전하다', async () => {
            // fresh=[]이면 unanalyzed는 항상 빈 배열이 된다(unanalyzed = fresh.filter(...)).
            // 따라서 listBySymbol로 DB를 조회할 필요가 없고, runNewsCardAnalysis도
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
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
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
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            // revalidateTag는 changedCount=0이므로 호출되지 않아야 한다.
            expect(revalidateTagSpy).not.toHaveBeenCalled();
            // 그러나 분석 단계는 반드시 실행되어야 한다 — 미분석 기사를 구제해야 하므로.
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledWith(
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
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('done/error 결과는', () => {
        it('runNewsCardAnalysis가 done을 반환하면 attachAnalysis를 호출한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).toHaveBeenCalledWith(
                NEWS_ITEM_1.id,
                CARD_ANALYSIS,
                expect.any(Date)
            );
        });

        it('runNewsCardAnalysis가 throw하면 attachAnalysis를 호출하지 않는다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockRejectedValue(
                new Error('LLM worker failed')
            );

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockAttachAnalysis).not.toHaveBeenCalled();
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
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(2);
        });

        it('upsert 과반 실패 시 throw하지 않고 삼킨 뒤 조용히 리턴한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            // Both upserts fail → 2/2 > 50%, triggers majority-failure throw
            // inside ingestNewsForSymbol — but this fire-and-forget call site
            // must swallow it (PR #700 review), not propagate.
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        // PR #700 리뷰 — 이 액션은 fire-and-forget(waitUntil) 계약이므로
        // NewsIngestWriteError를 절대 위로 던지면 안 된다. prewarmNews(cron)와
        // 대칭적인 반대 계약: 여기선 삼키고 로그만 남긴다.
        it('NewsIngestWriteError를 삼키고 지정된 접두사로 로깅한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[ensureNewsCardsAnalyzedAction] ingest failed for AAPL:'
                ),
                expect.any(NewsIngestWriteError)
            );
            errorSpy.mockRestore();
        });

        it('카드 분석 실패 시 reject하지 않고 계속 진행한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            mockRunNewsCardAnalysis
                .mockRejectedValueOnce(new Error('LLM timeout'))
                .mockResolvedValueOnce(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL')
            ).resolves.toBeUndefined();

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(2);
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
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
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
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(1);
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_2 })
            );
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalledWith(
                expect.objectContaining({ item: NEWS_ITEM_1 })
            );
        });

        it('listBySymbol 실패 시 에러를 전파한다', async () => {
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockListBySymbol.mockRejectedValue(new Error('DB connection lost'));

            await expect(ensureNewsCardsAnalyzedAction('AAPL')).rejects.toThrow(
                'DB connection lost'
            );
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
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
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('false이면 기존과 동일하게 LLM 분석까지 수행한다', async () => {
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL', {
                skipAnalysis: false,
            });

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(1);
            // markFetched must fire on the human path too (it sits before the
            // skipAnalysis short-circuit). Guards against regressions that move
            // the call into the bot-only branch.
            expect(mockMarkFetched).toHaveBeenCalledWith('AAPL');
        });
    });

    // ── FIX 3(감사) — 동시 LLM 호출 상한 ──

    describe('동시 카드 분석 제한은', () => {
        it('FIX 3 — unanalyzed 아이템이 NEWS_CARD_ANALYSIS_PARALLEL_LIMIT를 초과해도 전부 분석된다', async () => {
            // NEWS_CARD_ANALYSIS_PARALLEL_LIMIT보다 많은 아이템을 주고 전부 처리됨을 검증.
            // 청크 단위 병렬 실행의 순기능(처리 완전성) 확인.
            const count = NEWS_CARD_ANALYSIS_PARALLEL_LIMIT + 3;
            const manyItems: (typeof NEWS_ITEM_1)[] = Array.from(
                { length: count },
                (_, i) => ({
                    id: `bulk-${i}`,
                    symbol: 'AAPL',
                    source: 'Reuters',
                    url: `https://reuters.com/${i}`,
                    publishedAt: '2025-07-01T10:00:00.000Z',
                    titleEn: `Article ${i}`,
                    bodyEn: `Body ${i}`,
                })
            );
            mockFetchNewsForPeriod.mockResolvedValue(manyItems);
            // 모두 미분석 상태.
            mockListBySymbol.mockResolvedValue(
                manyItems.map(item => ({ id: item.id, analyzedAt: null }))
            );
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(count);
        });

        it('FIX 3 — 일부 아이템 분석이 실패해도 나머지는 모두 처리된다(fail-open)', async () => {
            const count = NEWS_CARD_ANALYSIS_PARALLEL_LIMIT + 2;
            const items: (typeof NEWS_ITEM_1)[] = Array.from(
                { length: count },
                (_, i) => ({
                    id: `failtest-${i}`,
                    symbol: 'AAPL',
                    source: 'Reuters',
                    url: `https://reuters.com/fail-${i}`,
                    publishedAt: '2025-07-01T10:00:00.000Z',
                    titleEn: `Article ${i}`,
                    bodyEn: `Body ${i}`,
                })
            );
            mockFetchNewsForPeriod.mockResolvedValue(items);
            mockListBySymbol.mockResolvedValue(
                items.map(item => ({ id: item.id, analyzedAt: null }))
            );
            // 첫 번째 아이템만 실패.
            mockRunNewsCardAnalysis
                .mockRejectedValueOnce(new Error('LLM timeout'))
                .mockResolvedValue(DONE_RESULT);

            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await ensureNewsCardsAnalyzedAction('AAPL');
            errSpy.mockRestore();

            // 전체 아이템에 대해 분석이 시도된다.
            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(count);
            // 실패한 첫 항목을 제외한 나머지는 attachAnalysis 호출.
            expect(mockAttachAnalysis).toHaveBeenCalledTimes(count - 1);
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
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
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

        it('최근 fetch됐으면 사람 경로도 FMP 재조회와 upsert를 건너뛴다', async () => {
            // 이전에는 이 가드가 `skipAnalysis` 뒤에 걸려 사실상 죽어 있었고, 그
            // 동작("사람은 항상 fresh")을 이 테스트가 고정하고 있었다. 그런데 이
            // 액션은 `useEffect`에서 fire-and-forget으로 나가므로 트리거를 쏜 본인의
            // 화면에는 애초에 반영되지 않는다 — 적재 결과는 `revalidateTag` 이후의
            // 다음 렌더에 들어간다. 그래서 TTL의 실제 대가는 "10분 안에 들어온 다음
            // 방문자가 최대 10분 된 목록을 본다"뿐이고, 얻는 건 매 마운트 반복되던
            // 180일 FMP 조회 + 기사 수만큼의 Neon 왕복 제거다.
            //
            // 시장 뉴스 형제 경로(`ensureMarketNewsCardsAnalyzedAction`)가 같은
            // 플래그를 이미 봇·사람 구분 없이 같은 TTL로 걸고 있다 — 이제 정책이 같다.
            mockIsRecentlyFetched.mockResolvedValue(true);
            mockFetchNewsForPeriod.mockResolvedValue([NEWS_ITEM_1]);
            mockRunNewsCardAnalysis.mockResolvedValue(DONE_RESULT);

            await ensureNewsCardsAnalyzedAction('AAPL');

            expect(mockFetchNewsForPeriod).not.toHaveBeenCalled();
            expect(mockUpsertNewsItem).not.toHaveBeenCalled();
            expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
        });

        it('upsert 과반 실패 시 markFetched를 호출하지 않고, throw도 하지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockIsRecentlyFetched.mockResolvedValue(false);
            mockFetchNewsForPeriod.mockResolvedValue([
                NEWS_ITEM_1,
                NEWS_ITEM_2,
            ]);
            // Both upserts fail → majority failure inside ingestNewsForSymbol,
            // but the action swallows NewsIngestWriteError (fire-and-forget
            // contract, PR #700 review) instead of propagating it — markFetched
            // still never runs because the throw happens before it.
            mockUpsertNewsItem
                .mockRejectedValueOnce(new Error('DB down'))
                .mockRejectedValueOnce(new Error('DB down'));

            await expect(
                ensureNewsCardsAnalyzedAction('AAPL', { skipAnalysis: true })
            ).resolves.toBeUndefined();

            expect(mockMarkFetched).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
