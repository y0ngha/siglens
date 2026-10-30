import { cache } from 'react';

import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article/lib/cacheKeys';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';

/** 종목 뉴스 목록 행 — 뉴스·종합 탭이 같은 모양을 받는다. */
export type SymbolNewsListItems = Awaited<ReturnType<typeof getNewsList>>;

/**
 * 종목 뉴스 목록 — 뉴스 탭(본문·목록 섹션)과 종합 탭이 **같은 키·태그·TTL**로 읽는다.
 *
 * - 키·태그를 한 곳에서 만든다: 두 라우트가 같은 엔트리를 공유해야 한쪽 재생성이 채운 캐시를
 *   다른 쪽이 그대로 읽고, `news:${symbol}` 태그 무효화(`ensureNewsCardsAnalyzedAction`)가 둘 다에
 *   닿는다. 로케일을 키에 넣지 않으면 먼저 생성된 로케일의 번역 제목이 전 로케일에 굳는다.
 * - `React.cache`로 묶는다: 뉴스 탭은 본문(JSON-LD·AI 요약 게이트)과 목록 섹션이 같은 목록을
 *   쓴다. `unstable_cache`는 요청 안에서 중복을 없애지 않고(`cacheComponents` 꺼짐), 목록
 *   엔트리는 메모리 저장 상한을 넘어 매번 캐시 핸들러 원격 읽기라 두 번째 호출은 같은 프라미스를
 *   받게 한다.
 * - 실패는 `[]`로 흡수한다: DB가 throw해도 페이지 크롬(제목·AI 요약·형제 탭 링크)은 렌더되고,
 *   목록은 빈 상태 UI, 뉴스 탭은 `ItemList` JSON-LD 없이 나간다.
 */
export const loadSymbolNewsList = cache(
    (symbol: string, locale: Locale): Promise<SymbolNewsListItems> =>
        staticSymbolCache(
            [NEWS_LIST_CACHE_KEY, symbol, ...contentLocaleKeyPart(locale)],
            symbol,
            () => getNewsList(symbol, locale),
            [newsCacheTag(symbol)],
            SECONDS_PER_HALF_DAY
        ).catch((e: unknown): SymbolNewsListItems => {
            console.error(
                '[loadSymbolNewsList] getNewsList failed, degrading to []:',
                e
            );
            return [];
        })
);
