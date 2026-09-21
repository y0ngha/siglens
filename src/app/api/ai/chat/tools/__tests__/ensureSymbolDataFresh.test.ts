const {
    mockIsRecentlyFetched,
    mockIngestNewsForSymbol,
    mockRevalidateTag,
    FakeNewsIngestWriteError,
} = vi.hoisted(() => ({
    mockIsRecentlyFetched: vi.fn(),
    mockIngestNewsForSymbol: vi.fn(),
    mockRevalidateTag: vi.fn(),
    FakeNewsIngestWriteError: class extends Error {
        constructor() {
            super('majority upsert failure');
            this.name = 'NewsIngestWriteError';
        }
    },
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {},
    ingestNewsForSymbol: mockIngestNewsForSymbol,
    isRecentlyFetched: mockIsRecentlyFetched,
    // 구현과 동일한 값(lib/newsLookback.ts). 분석 창 30일.
    NEWS_ANALYSIS_LOOKBACK_MS: 30 * 24 * 60 * 60 * 1000,
    NewsIngestWriteError: FakeNewsIngestWriteError,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

import { ensureSymbolNewsFresh } from '../ensureSymbolDataFresh';
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

        expect(mockRevalidateTag).toHaveBeenCalledWith('news:LAES', 'max');
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
