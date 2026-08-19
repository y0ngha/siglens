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
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

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
        // 서버 전용 컬럼 배제는 `DrizzleNewsRepository.listCardsBySymbol` 테스트가
        // SELECT 목록까지 포함해 진다 — 여기서 다시 단언하면 mock 픽스처를 자기가
        // 자기에게 확인하는 꼴이라 어떤 회귀도 못 잡는다(감사: 테스트 라운드 17).
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
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result[0].titleKo).toBeNull();
        expect(result[0].sentiment).toBeNull();
        expect(result[0].priceImpact).toBeNull();
    });

    /**
     * 이 액션은 3초마다 호출된다. 상한이 없으면 화면이 다루지 않는 행까지 매 tick
     * 실어 보내고, `compress: true` 이후로는 그 응답이 매번 오리진에서 gzip된다.
     * 자르는 방향도 함께 고정한다 — `slice(-N)`으로 뒤집히면 서버 렌더는 최신 50개를
     * 보여준 뒤 첫 폴링에서 **가장 오래된 50개로 조용히 뒤바뀐다**.
     */
    it('상한을 넘으면 앞(최신)에서 상한만큼만 돌려준다', async () => {
        const rows = Array.from(
            { length: NEWS_ROW_SERIALIZATION_LIMIT + 137 },
            (_, i) => ({ id: `n${i}` })
        );
        mockListCardsBySymbol.mockResolvedValue(rows);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toHaveLength(NEWS_ROW_SERIALIZATION_LIMIT);
        expect(result[0]).toEqual({ id: 'n0' });
        expect(result.at(-1)).toEqual({
            id: `n${NEWS_ROW_SERIALIZATION_LIMIT - 1}`,
        });
    });

    it('상한 이하이면 그대로 돌려준다', async () => {
        const rows = Array.from(
            { length: NEWS_ROW_SERIALIZATION_LIMIT },
            (_, i) => ({ id: `n${i}` })
        );
        mockListCardsBySymbol.mockResolvedValue(rows);

        expect(await getNewsCardsAction('AAPL')).toHaveLength(
            NEWS_ROW_SERIALIZATION_LIMIT
        );
    });
});
