import { constants } from 'node:http2';
import { NextResponse } from 'next/server';
import { loadStaticChildEntries } from '@/app/api/sitemap/_shared/childEntries';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_RETRY_AFTER_SECONDS,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';
import { buildRssXml } from '@/entities/rss-feed/lib/buildRssXml';
import type { RssItem } from '@/entities/rss-feed/model';
import { RSS_FEED_URL } from '@/shared/config/rssFeed';
import {
    hashHubBody,
    readHubContentStamp,
} from '@/shared/cache/hubContentStamp';
import {
    clampAtSentenceBoundary,
    collapseToSingleLine,
    SITE_URL,
    takeWholeSentences,
} from '@/shared/lib/seo';
import { rssSources, type RssSource } from './sources';

// sitemap과 같은 이유로 force-dynamic + CDN 캐시다. 항목은 Redis 스탬프에 달려 있어
// 빌드 시점에 굳히면 안 된다.
const { HTTP_STATUS_SERVICE_UNAVAILABLE } = constants;

export const dynamic = 'force-dynamic';

/** 항목 설명 상한(code point). 리더 목록 미리보기에 쓰이는 길이다. */
const DESCRIPTION_MAX_LENGTH = 300;
/** 스탬프 해시에서 guid에 쓰는 앞자리 수. */
const GUID_HASH_LENGTH = 12;

const CHANNEL = {
    title: 'Siglens 시장 브리핑',
    description:
        '시장 브리핑과 뉴스 요약 — 규칙으로 계산한 값을 AI가 문장으로 정리했습니다.',
    language: 'ko',
} as const;

/** 마크다운을 떼고 한 줄로 합친 뒤 문장 경계에서 줄인다(`seo.ts`의 description 헬퍼 재사용). */
function toDescription(prose: string): string {
    const plain = collapseToSingleLine(prose);
    return (
        takeWholeSentences(plain, DESCRIPTION_MAX_LENGTH) ??
        clampAtSentenceBoundary(plain, DESCRIPTION_MAX_LENGTH)
    );
}

/**
 * 소스 하나를 항목으로 만든다. 다음 중 하나라도 없으면 `null`이다 — 날짜를 지어내지 않는다.
 *
 * - 본문(페이지가 읽는 reader의 결과)
 * - 스탬프, 그리고 `stamp.hash === hashHubBody(body)` — 크론이 **이 정확한 본문**을 확인한
 *   적이 있어야 `stamp.at`이 "이 글이 처음 나타난 시각"이다. 해시가 다르면 페이지는 크론이
 *   본 적 없는 본문(다른 키의 캐시)을 보여 주는 중이라 그 시각은 이 글의 것이 아니다.
 * - 정적 sitemap에 실린 허브 — 색인 대상이 아닌 페이지를 구독 대상으로 내놓지 않는다.
 */
async function toItem(
    source: RssSource,
    declaredUrls: ReadonlySet<string>
): Promise<RssItem | null> {
    if (source.path === null) return null;
    const link = `${SITE_URL}${source.path}`;
    if (!declaredUrls.has(link)) return null;

    const read = await source.read();
    if (read === null) return null;
    const stamp = await readHubContentStamp(source.surface);
    if (stamp === null || stamp.hash !== hashHubBody(read.body)) return null;

    const pubDate = new Date(stamp.at);
    if (Number.isNaN(pubDate.getTime())) return null;
    const description = toDescription(read.prose);
    if (description === '') return null;

    return {
        title: source.title,
        link,
        guid: `${link}#${stamp.hash.slice(0, GUID_HASH_LENGTH)}`,
        pubDate,
        description,
    };
}

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;

    // 정적 sitemap 엔트리를 못 읽으면 어떤 허브가 색인 대상인지 모른다 — 빈 피드를 200으로
    // 내면 CDN이 1시간 캐시하고 구독자는 "항목 없음"으로 읽는다. sitemap 라우트와 같이
    // 503 + Retry-After로 답한다(`Cache-Control`은 두지 않는다 — 장애를 캐시하지 않는다).
    let declaredUrls: ReadonlySet<string>;
    try {
        declaredUrls = new Set(
            (await loadStaticChildEntries(new Date())).map(entry => entry.url)
        );
    } catch (error) {
        console.error('[rss] static sitemap entries failed:', error);
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: { 'Retry-After': SITEMAP_RETRY_AFTER_SECONDS },
        });
    }
    const settled = await Promise.all(
        rssSources().map(source =>
            toItem(source, declaredUrls).catch(error => {
                // 소스 하나의 읽기 실패가 피드 전체를 500으로 만들면 구독자가 피드를 잃는다.
                console.error(`[rss] ${source.surface} failed:`, error);
                return null;
            })
        )
    );
    const items = settled.filter((item): item is RssItem => item !== null);

    const xml = buildRssXml({
        ...CHANNEL,
        link: SITE_URL,
        selfUrl: RSS_FEED_URL,
        items,
    });
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
