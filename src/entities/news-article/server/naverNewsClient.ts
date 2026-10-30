import type { NewsItem } from '@y0ngha/siglens-core';
import {
    NAVER_MAX_DISPLAY,
    searchNaverNews,
} from '@/shared/api/naver/naverSearch';
import { toNaverNewsItem } from '../lib/toNaverNewsItem';
import type { NewsClientPort } from './newsClientPort';

const LOG_TAG = '[naverNewsClient]';

/**
 * 한국 상장 종목 뉴스 클라이언트 — 네이버 검색 API.
 *
 * FMP 플랜이 KRX를 커버하지 않아 국내 종목에는 이 어댑터가 유일한 뉴스 소스다.
 * 엔드포인트·인증·마크업 정리는 `shared/api/naver/naverSearch.ts`가 소유한다(시장 단위
 * 클라이언트와 공유).
 *
 * **알려진 한계**: 네이버는 제목과 요약만 주고 본문은 주지 않으며, 본문 크롤링은 약관
 * 위반이다. 따라서 `bodyEn`에는 요약이 들어가고, 국내 종목의 뉴스 기반 분석은 미국
 * 종목보다 입력이 얕다. 본문이 필요해지면 빅카인즈·딥서치 같은 유료 API로 이 클래스만
 * 교체한다(`NewsClientPort` 경계가 그대로 유지된다).
 *
 * 자격증명이 없으면 빈 배열로 degrade한다 — 뉴스 탭만 비고 다른 탭은 영향받지 않는다.
 */
export class NaverNewsClient implements NewsClientPort {
    /**
     * @param resolveQuery - 심볼 → 검색어. 종목코드(`005930.KS`)로는 기사가 잡히지 않아
     * 한글 종목명이 필요하다. 이름 조회는 호출부(entities/ticker)의 책임이므로 주입받는다.
     */
    constructor(
        private readonly resolveQuery: (
            symbol: string
        ) => Promise<string | null>
    ) {}

    /** 검색어가 없으면 검색 자체를 건너뛰고, `lookbackMs` 이전 기사는 버린다. */
    async fetchNewsForPeriod(
        symbol: string,
        lookbackMs: number
    ): Promise<NewsItem[]> {
        const cutoff = new Date(Date.now() - lookbackMs);
        const query = await this.resolveQuery(symbol);
        if (!query) return [];

        const items = await searchNaverNews(query, NAVER_MAX_DISPLAY, LOG_TAG);
        return items
            .map(raw => toNaverNewsItem(raw, symbol))
            .filter(
                (item): item is NewsItem =>
                    item !== null && new Date(item.publishedAt) >= cutoff
            );
    }
}
