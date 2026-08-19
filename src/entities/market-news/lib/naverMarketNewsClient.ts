import { toNaverNewsItem } from '@/entities/news-article/lib/naverNewsClient';
import { searchNaverNews } from '@/entities/news-article/lib/naverNewsSearch';
import { CATEGORY_CONFIG, type NewsFeedCategoryId } from './categoryConfig';
import type {
    MarketNewsClientPort,
    MarketNewsItem,
} from './marketNewsClientPort';

const LOG_TAG = '[naverMarketNewsClient]';

/**
 * 질의 1건당 요청 건수.
 *
 * FMP 경로(`FMP_NEWS_FETCH_LIMIT = 50`)보다 작게 잡은 이유: 네이버는 질의를 여러 번
 * 돌려 합치므로 질의당 50이면 150건이 되고, 그 전부가 카드 단위 LLM 분석 대상이 된다.
 * 30 × 3 = 90건에서 중복을 걷어내면 FMP 카테고리와 비슷한 규모로 수렴한다.
 */
const NAVER_QUERY_DISPLAY = 30;

/**
 * 한국 시장 뉴스 클라이언트 — 네이버 검색 API.
 *
 * FMP 플랜에 KRX가 없어 국내 증시 시장 단위 피드는 이것이 유일한 소스다.
 * 종목 단위 어댑터(`entities/news-article`의 `NaverNewsClient`)와 저수준 검색
 * 함수·정규화를 공유한다 — 필드 의미(특히 `sourceLanguage: 'ko'`)가 갈리면
 * 한쪽 경로만 프롬프트에서 번역 지시를 받는다.
 *
 * 자격증명이 없거나 네이버가 실패하면 `searchNaverNews`가 `[]`로 degrade하므로
 * 이 클래스는 던지지 않는다 — 한국 카테고리만 비고 다른 카테고리는 영향받지 않는다.
 */
export class NaverMarketNewsClient implements MarketNewsClientPort {
    async fetchCategoryNews(
        category: NewsFeedCategoryId,
        lookbackMs: number
    ): Promise<MarketNewsItem[]> {
        const cfg = CATEGORY_CONFIG[category];
        if (cfg.source !== 'naver') {
            // 배선 실수(FMP 카테고리를 네이버 클라이언트로 보냄)를 조용한 빈 피드가
            // 아니라 로그로 드러낸다. 던지지 않는 이유는 클래스 주석 참조.
            console.error(
                `${LOG_TAG} non-naver category routed here`,
                category
            );
            return [];
        }

        const cutoff = new Date(Date.now() - lookbackMs);
        /*
         * 정확도순 질의 전부 + **최신순 보조 질의 하나**.
         *
         * 정확도순은 관련성이 압도적으로 좋지만(실측: 제목 적중률 90~98% vs 15~23%)
         * 최신을 보장하지 않는다. 뉴스가 뜸한 주에는 상위 결과가 전부 lookback 창
         * 밖으로 밀려 컷오프 뒤에 한 줌만 남고, 그러면 `/news/kr`이 200 + 안내문 +
         * noindex로 굳는다 — 로그는 전부 `200 OK`라 아무 신호가 없다.
         *
         * 그래서 첫 질의(가장 넓은 키워드)를 최신순으로 한 번 더 돌려 바닥을 깐다.
         * 호출 1회가 늘고, 겹치는 기사는 아래 dedupe가 걷어낸다.
         */
        const primaryQuery = cfg.naverQueries[0];
        const batches = await Promise.all([
            ...cfg.naverQueries.map(query =>
                searchNaverNews(query, NAVER_QUERY_DISPLAY, LOG_TAG)
            ),
            ...(primaryQuery === undefined
                ? []
                : [
                      searchNaverNews(
                          primaryQuery,
                          NAVER_QUERY_DISPLAY,
                          LOG_TAG,
                          'date'
                      ),
                  ]),
        ]);

        // URL 해시(id) 기준 중복 제거 — 같은 기사가 `코스피`·`국내 증시` 양쪽에
        // 잡히는 것이 정상이다. Map은 삽입 순서를 지키므로 앞선 질의가 이긴다.
        const byId = new Map<string, MarketNewsItem>();
        for (const raw of batches.flat()) {
            const item = toNaverNewsItem(raw, cfg.sentinel);
            if (item === null) continue;
            if (new Date(item.publishedAt) < cutoff) continue;
            if (byId.has(item.id)) continue;
            // 네이버는 기사에 붙은 종목코드를 주지 않는다. 추정으로 채우면 무관한
            // 종목 페이지에 기사가 걸리므로 비워 둔다.
            byId.set(item.id, { ...item, tickers: [] });
        }

        return [...byId.values()].toSorted((a, b) =>
            b.publishedAt.localeCompare(a.publishedAt)
        );
    }
}
