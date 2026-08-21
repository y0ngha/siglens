import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import type { NewsClientPort } from './newsClientPort';
import { computeCutoff, hashUrlToId } from './fmpNewsClient';
import { detectTruncatedBody } from './detectTruncatedBody';
import {
    NAVER_MAX_DISPLAY,
    searchNaverNews,
    stripNaverMarkup,
    toIsoPublishedAt,
    type NaverNewsItem,
} from './naverNewsSearch';

/** `NewsTimeRange`별 요청 건수. FMP 어댑터와 같은 축척이되 API 상한(100)에 맞춰 잘린다. */
const RANGE_TO_DISPLAY: Record<NewsTimeRange, number> = {
    '24h': 30,
    '7d': NAVER_MAX_DISPLAY,
    '30d': NAVER_MAX_DISPLAY,
};

// 기사 `source` 필드에 그대로 들어가는 **출처 이름**이다. 로케일별로 갈리면
// 같은 기사가 로케일마다 다른 출처로 저장된다 — 공식 영문 브랜드명 하나로 둔다.
const SOURCE_LABEL = 'Naver News';
const LOG_TAG = '[naverNewsClient]';

/**
 * 한국 상장 종목 뉴스 클라이언트 — 네이버 검색 API.
 *
 * FMP 플랜이 KRX를 커버하지 않아 국내 종목에는 이 어댑터가 유일한 뉴스 소스다.
 * 엔드포인트·인증·마크업 정리는 `naverNewsSearch.ts`가 소유한다(시장 단위
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

    async fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]> {
        return this.search(
            symbol,
            RANGE_TO_DISPLAY[range],
            computeCutoff(range)
        );
    }

    async fetchNewsForPeriod(
        symbol: string,
        lookbackMs: number
    ): Promise<NewsItem[]> {
        return this.search(
            symbol,
            NAVER_MAX_DISPLAY,
            new Date(Date.now() - lookbackMs)
        );
    }

    /**
     * 국내 실적 발표 일정은 네이버 검색 API에 없다. 캘린더 데이터를 추정으로 채우면
     * 잘못된 발표일이 화면에 박히므로 명시적으로 제공하지 않는다.
     */
    async fetchEarningsReport(): Promise<EarningsReport | null> {
        return null;
    }

    private async search(
        symbol: string,
        display: number,
        cutoff: Date
    ): Promise<NewsItem[]> {
        const query = await this.resolveQuery(symbol);
        if (!query) return [];

        const items = await searchNaverNews(query, display, LOG_TAG);
        return items.flatMap(raw => {
            const item = toNaverNewsItem(raw, symbol);
            if (item === null) return [];
            return new Date(item.publishedAt) >= cutoff ? [item] : [];
        });
    }
}

/**
 * 네이버 원본 기사 → core `NewsItem`.
 *
 * 시장 단위 클라이언트도 같은 정규화를 쓰므로 클래스 밖에 둔다 — 필드 의미
 * (특히 `sourceLanguage`)가 갈리면 한쪽 경로만 프롬프트에서 번역 지시를 받는다.
 *
 * @param symbol - DB 버킷 키. 종목 경로는 심볼, 시장 경로는 sentinel이 들어온다.
 */
export function toNaverNewsItem(
    raw: NaverNewsItem,
    symbol: string
): NewsItem | null {
    // 원문 링크를 우선한다 — 네이버 링크는 기사 이관 시 만료되지만 원문은 남는다.
    // 둘 다 없으면 URL이 id의 해시 입력이자 중복 제거 키라 기사를 버린다.
    const url = raw.originallink || raw.link;
    const publishedAt = toIsoPublishedAt(raw.pubDate);
    if (!url || !publishedAt || !raw.title) return null;

    const description = raw.description
        ? stripNaverMarkup(raw.description)
        : '';

    return {
        id: hashUrlToId(url),
        symbol,
        source: SOURCE_LABEL,
        url,
        publishedAt,
        // 필드명은 `titleEn`/`bodyEn`이지만 실제로는 "원문 언어"를 담는다 — 크립토·미국
        // 종목은 영문, 국내 종목은 한국어다. 어느 언어인지는 `sourceLanguage`가 알린다.
        titleEn: stripNaverMarkup(raw.title),
        // 본문은 제공되지 않는다(클래스 주석 참조). 요약이라도 넣어야 AI 분석이
        // 제목 한 줄만 보고 판단하지 않는다. 빈 문자열은 null로 정규화한다.
        bodyEn: description || null,
        // 네이버 기사는 이미 한국어다. 이 값이 없으면 core 프롬프트가 "영문을
        // 한국어로 번역하라"고 지시해, 토큰을 낭비할 뿐 아니라 이미 정확한 제목을
        // 모델이 조용히 고쳐 쓸 여지를 준다(core v0.45.0 `NewsItem.sourceLanguage`).
        // 요약·감성·분류는 언어와 무관하게 그대로 수행된다.
        sourceLanguage: 'ko',
        // 네이버 `description`은 본문 앞 ~120자를 기계적으로 잘라낸 조각이다
        // (실측 117~130자, 항상 `…`으로 끝남). AI 요약본이 아니다.
        bodyTruncated: detectTruncatedBody(description),
    };
}

// 기존 소비자·테스트가 이 모듈에서 import하던 헬퍼를 계속 노출한다
// (구현은 `naverNewsSearch.ts`로 옮겼다).
export { stripNaverMarkup } from './naverNewsSearch';
