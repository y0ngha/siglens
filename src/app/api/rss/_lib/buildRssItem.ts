import { rssItemTitle } from '@/app/api/rss/rssItemTitle';
import type { RssSource } from '@/app/api/rss/sources';
import type { RssItem } from '@/entities/rss-feed/model';
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
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';

/** 항목 설명 상한(code point). 리더 목록 미리보기에 쓰이는 길이다 — 전문은 `content:encoded`가 싣는다. */
export const DESCRIPTION_MAX_LENGTH = 500;
/** 스탬프 해시에서 guid에 쓰는 앞자리 수. */
const GUID_HASH_LENGTH = 12;

/** 마크다운을 떼고 한 줄로 합친 뒤 문장 경계에서 줄인다(`seo.ts`의 description 헬퍼 재사용). */
export function toDescription(prose: string): string {
    const plain = collapseToSingleLine(prose);
    return (
        takeWholeSentences(plain, DESCRIPTION_MAX_LENGTH) ??
        clampAtSentenceBoundary(plain, DESCRIPTION_MAX_LENGTH)
    );
}

/** 본문 전체를 마크다운을 떼고 문단(줄) 단위 평문으로 나눈다. `content:encoded`용. */
export function toParagraphs(prose: string): string[] {
    return stripSnapshotMarkdown(prose)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
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
export async function buildRssItem(
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
        title: rssItemTitle(source.title, pubDate),
        link,
        guid: `${link}#${stamp.hash.slice(0, GUID_HASH_LENGTH)}`,
        pubDate,
        description,
        paragraphs: toParagraphs(read.prose),
    };
}
