import type { NewsItem } from '@y0ngha/siglens-core';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';
import { detectTruncatedBody } from '@/shared/lib/news/detectTruncatedBody';
import {
    stripNaverMarkup,
    toIsoPublishedAt,
    type NaverNewsItem,
} from '@/shared/api/naver/naverSearch';

/**
 * 기사 `source` 필드에 그대로 들어가는 출처 이름이다. 로케일별로 갈리면 같은 기사가
 * 로케일마다 다른 출처로 저장되므로 공식 영문 브랜드명 하나로 둔다.
 */
export const NAVER_NEWS_SOURCE_LABEL = 'Naver News';

/**
 * 네이버 원본 기사를 core `NewsItem`으로 정규화한다. 종목 단위(`NaverNewsClient`)와
 * 시장 단위(`naverMarketNewsClient`) 클라이언트가 함께 쓴다 — 필드 의미(특히
 * `sourceLanguage`)가 갈리면 한쪽 경로만 프롬프트에서 번역 지시를 받는다.
 *
 * 원문 링크(`originallink`)를 우선한다 — 네이버 링크는 기사 이관 시 만료되지만 원문은
 * 남는다. URL이 id의 해시 입력이자 중복 제거 키라, 링크·발행일·제목 중 하나라도
 * 없으면 `null`로 버린다.
 *
 * @param symbol - DB 버킷 키. 종목 경로는 심볼, 시장 경로는 sentinel이 들어온다.
 */
export function toNaverNewsItem(
    raw: NaverNewsItem,
    symbol: string
): NewsItem | null {
    const url = raw.originallink || raw.link;
    const publishedAt = toIsoPublishedAt(raw.pubDate);
    if (!url || !publishedAt || !raw.title) return null;

    const description = raw.description
        ? stripNaverMarkup(raw.description)
        : '';

    return {
        id: hashUrlToId(url),
        symbol,
        source: NAVER_NEWS_SOURCE_LABEL,
        url,
        publishedAt,
        // 필드명은 `titleEn`/`bodyEn`이지만 실제로는 "원문 언어"를 담는다 — 크립토·미국
        // 종목은 영문, 국내 종목은 한국어다. 어느 언어인지는 `sourceLanguage`가 알린다.
        titleEn: stripNaverMarkup(raw.title),
        // 네이버는 본문을 주지 않는다(`NaverNewsClient` 참조). 요약이라도 넣어야 AI 분석이
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
