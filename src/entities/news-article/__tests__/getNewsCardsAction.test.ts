const { mockGetDatabaseClient, mockListCardsBySymbol, mockListBySymbol } =
    vi.hoisted(() => ({
        mockGetDatabaseClient: vi.fn(),
        // 카드 경로는 `bodyEn`을 select에서 빼는 전용 투영을 쓴다 — 전 컬럼을 읽는
        // `listBySymbol`을 쓰면 3초 폴링마다 기사 원문을 받아서 버린다
        // (감사: 비용 라운드 14).
        mockListCardsBySymbol: vi.fn(),
        mockListBySymbol: vi.fn(),
    }));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {
        listCardsBySymbol = mockListCardsBySymbol;
        listBySymbol = mockListBySymbol;
    },
}));

import { getNewsCardsAction } from '@/entities/news-article/actions/getNewsCardsAction';

describe('getNewsCardsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDatabaseClient.mockReturnValue({ db: {} });
    });

    it('본문 전체를 읽는 listBySymbol을 쓰지 않는다', async () => {
        // 3초 폴링 경로다 — `bodyEn`(기사 원문)을 읽어서 버리면 그 전송이 매 tick
        // 반복된다. select 단계에서 빼는 전용 투영을 써야 한다.
        mockListCardsBySymbol.mockResolvedValue([]);

        await getNewsCardsAction('AAPL');

        expect(mockListCardsBySymbol).toHaveBeenCalledTimes(1);
        expect(mockListBySymbol).not.toHaveBeenCalled();
    });

    // 투영은 이제 액션이 아니라 **리포지터리의 SELECT**가 한다 — 액션은 그 결과를
    // 그대로 돌려준다(중복 재매핑 제거, 감사: 코드 라운드 16). 그래서 mock도 카드
    // 형상이어야 실제 계약을 흉내낸다. "서버 전용 컬럼이 안 나온다"는 단언은
    // `DrizzleNewsRepository.listCardsBySymbol` 테스트가 SELECT 목록까지 포함해 진다.
    it('리포지터리가 돌려준 카드를 그대로 반환한다', async () => {
        mockListCardsBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Apple beats earnings',
                titleKo: '애플 실적 발표',
                sentiment: 'bullish',
                category: 'earnings',
                bodyKo: '한국어 본문',
                summaryKo: '요약',
                priceImpact: 'high',
                url: 'https://example.com/1',
                source: 'reuters',
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'news-1',
            publishedAt: '2026-05-25T10:00:00Z',
            titleEn: 'Apple beats earnings',
            titleKo: '애플 실적 발표',
            sentiment: 'bullish',
            category: 'earnings',
            bodyKo: '한국어 본문',
            summaryKo: '요약',
            priceImpact: 'high',
            url: 'https://example.com/1',
            source: 'reuters',
        });

        // Ensure internal fields are stripped
        expect(result[0]).not.toHaveProperty('bodyEn');
        expect(result[0]).not.toHaveProperty('symbol');
        expect(result[0]).not.toHaveProperty('analyzedAt');
    });

    it('returns empty array when no news items exist', async () => {
        mockListCardsBySymbol.mockResolvedValue([]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toEqual([]);
    });

    it('maps multiple rows correctly', async () => {
        mockListCardsBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Title 1',
                titleKo: null,
                sentiment: null,
                category: null,
                bodyKo: null,
                summaryKo: null,
                priceImpact: null,
                url: 'https://example.com/1',
                source: 'reuters',
            },
            {
                id: 'news-2',
                publishedAt: '2026-05-25T11:00:00Z',
                titleEn: 'Title 2',
                titleKo: '제목 2',
                sentiment: 'bearish',
                category: 'macro',
                bodyKo: '본문',
                summaryKo: '요약',
                priceImpact: 'low',
                url: 'https://example.com/2',
                source: 'bloomberg',
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('news-1');
        expect(result[1].id).toBe('news-2');
        // 서버 전용 컬럼 배제는 리포지터리 테스트가 SELECT 목록까지 포함해 진다.
        expect(result[0]).not.toHaveProperty('bodyEn');
        expect(result[1]).not.toHaveProperty('bodyEn');
    });

    it('preserves null fields in the output', async () => {
        mockListCardsBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Pending analysis',
                titleKo: null,
                sentiment: null,
                category: null,
                bodyKo: null,
                summaryKo: null,
                priceImpact: null,
                url: 'https://example.com/1',
                source: 'reuters',
                bodyEn: null,
                symbol: 'AAPL',
                analyzedAt: null,
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result[0].titleKo).toBeNull();
        expect(result[0].sentiment).toBeNull();
        expect(result[0].priceImpact).toBeNull();
    });
});
