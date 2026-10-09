import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import { getDatabaseClient } from '@/shared/db/client';
import { RELEASE_ID } from '@/shared/config/release';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { guideEntries, guideEntryContents } from '@/shared/db/schema';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import { mapGuideRows } from './lib/mapGuideRows';
import type { GuideCatalog } from './types';

/** 가이드 데이터 캐시 태그·키 접두사. */
const GUIDE_CACHE_TAG = 'guide';

async function fetchGuideCatalog(locale: Locale): Promise<GuideCatalog> {
    const { db } = getDatabaseClient();
    const locales =
        locale === DEFAULT_LOCALE ? [locale] : [locale, DEFAULT_LOCALE];
    const rows = await withRetry(
        () =>
            db
                .select({
                    slug: guideEntries.slug,
                    category: guideEntries.category,
                    sortOrder: guideEntries.sortOrder,
                    related: guideEntries.related,
                    entryUpdatedAt: guideEntries.updatedAt,
                    locale: guideEntryContents.locale,
                    title: guideEntryContents.title,
                    aliases: guideEntryContents.aliases,
                    summary: guideEntryContents.summary,
                    seoTitle: guideEntryContents.seoTitle,
                    seoDescription: guideEntryContents.seoDescription,
                    demoCaption: guideEntryContents.demoCaption,
                    bodyMd: guideEntryContents.bodyMd,
                    faq: guideEntryContents.faq,
                    contentUpdatedAt: guideEntryContents.updatedAt,
                })
                .from(guideEntryContents)
                .innerJoin(
                    guideEntries,
                    eq(guideEntryContents.slug, guideEntries.slug)
                )
                .where(inArray(guideEntryContents.locale, locales)),
        DB_TRANSIENT_RETRY
    );
    // 매핑 결과(날짜가 ISO 문자열)를 캐시한다 — 데이터 캐시는 JSON이라 Date가 살아남지 않는다.
    return mapGuideRows(rows, locale);
}

/**
 * 차트 가이드 카탈로그 전체(90개 항목)를 `locale`로 읽는다 — 한 번의 조인 쿼리.
 *
 * 번역 행이 없는 항목은 ko 내용으로 채우고 `isFallback`을 세운다.
 *
 * **조회는 `unstable_cache` 안에서 한다**(`src/app/CLAUDE.md` 축 1). 가이드 페이지는 ISR
 * 정적 렌더라, 캐시 밖 DB 조회는 `noStoreQueryLogger`가 렌더를 동적으로 바꿔 ISR이 깨진다
 * (약관 페이지 v0.96.0 장애와 같은 경로). TTL은 페이지 revalidate(24시간)와 같게 둔다 —
 * 더 짧으면 그 주기로 페이지 전체가 재생성된다. 에이전트 도구(`get_guide`)도 같은 캐시를
 * 쓰므로 호출마다 본문 전체를 다시 읽지 않는다.
 *
 * 실패는 캐시 **밖**에서 잡는다 — 안에서 `null`을 돌려주면 장애가 하루 동안 캐시된다.
 * 빈 카탈로그(시드 전)도 캐시 밖에서 `null`로 바꾼다.
 *
 * `null`이면 호출부가 "준비 중" 화면으로 degrade한다(500 금지): 오프라인 빌드, 테이블이
 * 아직 없음(마이그레이션 전), DB 오류, 시드 전이라 항목이 하나도 없음.
 */
export const loadGuideCatalog = cache(
    async (locale: Locale): Promise<GuideCatalog | null> => {
        if (isOfflineBuild()) return null;
        try {
            const catalog = await unstable_cache(
                () => fetchGuideCatalog(locale),
                [GUIDE_CACHE_TAG, 'catalog', locale, RELEASE_ID],
                { revalidate: SECONDS_PER_DAY, tags: [GUIDE_CACHE_TAG] }
            )();
            return catalog.entries.length === 0 ? null : catalog;
        } catch (error) {
            console.error('[guide] 카탈로그 조회 실패', error);
            return null;
        }
    }
);
