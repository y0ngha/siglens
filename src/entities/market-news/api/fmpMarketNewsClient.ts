import { fmpGet } from '@/shared/api/fmp/httpClient';
import { normalizeFmpPublishedDate } from '@/shared/api/fmp/normalizeFmpPublishedDate';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import {
    selectFmpArticleItems,
    selectFmpLatestItems,
    type FmpSelectionContext,
    type RawFmpArticle,
    type RawFmpLatestNews,
} from '../lib/fmpNewsMapping';
import type {
    MarketNewsClientPort,
    MarketNewsItem,
} from '../lib/marketNewsClientPort';
import { FMP_NEWS_FETCH_LIMIT } from '../lib/marketNewsConstants';

/**
 * 미국·암호화폐 카테고리 피드의 FMP 어댑터. `getMarketNewsClient`가 `source: 'fmp'`
 * 카테고리에 이 클래스를 쓴다.
 */
export class FmpMarketNewsClient implements MarketNewsClientPort {
    /** 날짜 정규화 실패 경고는 인스턴스당 한 번이면 장애를 드러내기에 충분하다. */
    private hasWarnedNormalizeFailure = false;

    private tryNormalizeFmpPublishedDate(value: string): string | null {
        try {
            return normalizeFmpPublishedDate(value);
        } catch {
            if (!this.hasWarnedNormalizeFailure) {
                this.hasWarnedNormalizeFailure = true;
                console.warn(
                    `[FmpMarketNewsClient] failed to normalize date: ${value}`
                );
            }
            return null;
        }
    }

    /**
     * 카테고리 시장 피드를 받아 lookback 창 안의 기사만 돌려준다. `CATEGORY_CONFIG`의
     * sentinel이 모든 기사에 붙어 저장소가 버킷을 가를 수 있다.
     *
     * 로펌 원고 모집 보도자료(`isLawFirmSolicitation`)는 매핑 **전에** 버린다 — 선별은
     * `lib/fmpNewsMapping`이 한다. 이 필터가 생기기 전에 적재된 행은 저장소 읽기 경로가
     * 숨긴다.
     *
     * 응답 형상이 둘이다: `latest`(`general`/`stock`/`crypto`/`forex`)와 `articles`.
     */
    async fetchCategoryNews(
        category: NewsFeedCategoryId,
        lookbackMs: number
    ): Promise<MarketNewsItem[]> {
        const cfg = CATEGORY_CONFIG[category];
        if (cfg.source !== 'fmp') {
            // 배선 실수를 조용한 빈 피드가 아니라 로그로 드러낸다 — 네이버 카테고리는
            // `fmpEndpoint`가 빈 문자열이라 그대로 두면 `fmpGet('')`까지 간다.
            // 자매 어댑터(`NaverMarketNewsClient`)와 대칭.
            console.error(
                '[fmpMarketNewsClient] non-fmp category routed here',
                category
            );
            return [];
        }
        const { sentinel, fmpEndpoint } = cfg;
        const context: FmpSelectionContext = {
            sentinel,
            cutoff: new Date(Date.now() - lookbackMs),
            normalizeDate: value => this.tryNormalizeFmpPublishedDate(value),
        };

        const params = { limit: String(FMP_NEWS_FETCH_LIMIT) };

        if (category === 'articles') {
            return selectFmpArticleItems(
                await fmpGet<RawFmpArticle[]>(fmpEndpoint, params),
                context
            );
        }
        return selectFmpLatestItems(
            await fmpGet<RawFmpLatestNews[]>(fmpEndpoint, params),
            context
        );
    }
}
