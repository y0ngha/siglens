import { toNaverNewsItem } from '@/entities/news-article/lib/naverNewsClient';
import {
    NAVER_MAX_DISPLAY,
    searchNaverNews,
} from '@/entities/news-article/lib/naverNewsSearch';
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
        const batches = await Promise.all(
            cfg.naverQueries.map(query =>
                searchNaverNews(
                    query,
                    Math.min(NAVER_QUERY_DISPLAY, NAVER_MAX_DISPLAY),
                    LOG_TAG
                )
            )
        );

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

        return [...byId.values()].sort((a, b) =>
            b.publishedAt.localeCompare(a.publishedAt)
        );
    }
}
