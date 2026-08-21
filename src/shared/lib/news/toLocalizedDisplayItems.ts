import 'server-only';

import type {
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import type { NewsDisplayItem } from '@/shared/lib/types';
import type { Locale } from '@/shared/i18n/locales';
import { localizeContent } from '@/shared/db/localizeContent';
import type { LocalizedContent } from '@/shared/db/contentLocale';
import {
    CONTENT_FIELD,
    type TranslatableEntity,
} from '@/shared/db/contentTranslationFields';
import {
    toNewsCategory,
    toNewsImpact,
    toNewsSentiment,
} from './newsEnumCoercion';

/** 카드 투영으로 읽은 DB 행 — `news`와 `market_news`가 같은 형상이다. */
export interface NewsCardDbRow {
    id: string;
    source: string;
    url: string;
    publishedAt: Date;
    titleEn: string;
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    sentiment: string | null;
    category: string | null;
    priceImpact: string | null;
}

/**
 * 카드 행을 요청 로케일로 해석해 `NewsDisplayItem[]`으로 만든다.
 *
 * `news`와 `market_news`가 컬럼도 소비자도 같아서 한 함수를 공유한다 — 예전에
 * 두 슬라이스가 같은 투영을 따로 구현하다 한쪽만 고쳐지는 일이 있었다.
 * `shared`에 두는 이유는 그 둘이 **다른 슬라이스**이기 때문이다 — entities 간
 * deep import는 FSD 규칙 위반이고, `server-only`라 배럴로 내보내면 클라이언트
 * 번들에 서버 모듈이 새어 들어갈 위험이 생긴다(v0.58.0과 같은 결함군).
 *
 * **해석값은 원본과 다를 때만 붙인다.** 한국어 사용자에게는 사이드카 값이
 * `titleKo`와 같으므로, 그대로 실으면 ISR 블롭과 RSC 페이로드가 목록 20건 ×
 * 3필드만큼 두 배가 된다(이 레포는 RSC 페이로드를 실제로 줄여 왔다).
 */
export async function toLocalizedDisplayItems(
    rows: readonly NewsCardDbRow[],
    locale: Locale,
    entity: TranslatableEntity
): Promise<NewsDisplayItem[]> {
    const localized = await localizeContent({
        entity,
        rows,
        locale,
        id: row => row.id,
        fields: {
            title: {
                field: CONTENT_FIELD.news.title,
                legacy: row => ({ ko: row.titleKo, en: row.titleEn }),
            },
            summary: {
                field: CONTENT_FIELD.news.summary,
                legacy: row => ({ ko: row.summaryKo }),
            },
            body: {
                field: CONTENT_FIELD.news.body,
                legacy: row => ({ ko: row.bodyKo }),
            },
        },
    });

    return localized.map(row => {
        const item: NewsDisplayItem = {
            id: row.id,
            source: row.source,
            url: row.url,
            publishedAt: row.publishedAt.toISOString(),
            titleEn: row.titleEn,
            titleKo: row.titleKo,
            bodyKo: row.bodyKo,
            summaryKo: row.summaryKo,
            sentiment: toNewsSentiment(row.sentiment) as NewsSentiment | null,
            category: toNewsCategory(row.category) as NewsCategory | null,
            priceImpact: toNewsImpact(row.priceImpact) as NewsImpact | null,
        };
        assignFromSidecar(item, 'titleLocalized', row.localized.title);
        assignFromSidecar(item, 'summaryLocalized', row.localized.summary);
        assignFromSidecar(item, 'bodyLocalized', row.localized.body);
        return item;
    });
}

/**
 * **사이드카에서 온 값만** 붙인다.
 *
 * 두 가지를 동시에 지킨다.
 *
 * 1. 페이로드: 원본과 같은 값을 다시 실으면 목록 20건 × 3필드만큼 ISR 블롭과
 *    RSC 페이로드가 커진다.
 * 2. **ISR 캐시 정합성**: 뉴스 원본은 `title_ko`/`title_en`을 이미 갖고 있어서,
 *    사이드카가 꺼져 있어도 레거시 해석은 로케일별로 갈린다. 그 값을 캐시되는
 *    행에 실으면 블롭이 로케일 의존이 되는데 키에는 로케일이 없어
 *    (`contentLocaleKeyPart`가 꺼짐 상태에서 빈 배열) **먼저 생성된 로케일의
 *    헤드라인이 네 로케일 전부에 굳는다** — 영어가 먼저 warm되면 색인된 한국어
 *    뉴스 페이지에 영어 헤드라인이 박힌다(SEO 감사 라운드 1 S1).
 *
 *    레거시 ko/en 분기는 캐시 **뒤** 렌더 시점의 `resolveNewsTitle`이 그대로
 *    처리한다 — 이 함수가 손대기 전의 동작이고, 그때는 블롭이 로케일 불변이었다.
 */
function assignFromSidecar(
    item: NewsDisplayItem,
    key: 'titleLocalized' | 'summaryLocalized' | 'bodyLocalized',
    localized: LocalizedContent<string> | null
): void {
    if (localized === null || !localized.fromSidecar) return;
    item[key] = localized.value;
}
