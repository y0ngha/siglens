import { rssItemTitle } from '@/app/api/rss/rssItemTitle';
import type { RssSource } from '@/app/api/rss/sources';
import type { RssItem } from '@/entities/rss-feed/model';
import {
    hashHubBody,
    matchHubContentStamp,
    readHubContentStamp,
} from '@/shared/cache/hubContentStamp';
import { SITE_URL } from '@/shared/lib/seo';
import {
    clampAtSentenceBoundary,
    collapseToSingleLine,
} from '@/shared/lib/seoSnapshotDescription';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';
import { takeWholeSentences } from '@/shared/lib/truncate';

/** 항목 설명 상한(code point). 리더 목록 미리보기에 쓰이는 길이다 — 전문은 `content:encoded`가 싣는다. */
export const DESCRIPTION_MAX_LENGTH = 500;
/** 스탬프 해시에서 guid에 쓰는 앞자리 수. */
const GUID_HASH_LENGTH = 12;

/** 마크다운을 떼고 한 줄로 합친 뒤 문장 경계에서 줄인다(`seoSnapshotDescription.ts`의 description 헬퍼 재사용). */
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
 * 항목을 낼 수 있는 소스인가 — 공개 경로가 있고 그 허브가 정적 sitemap에 실려 있다. 항목 빌더와
 * 라우트의 "줄어든 피드" 판정이 같은 규칙을 본다.
 */
export function isEligibleRssSource(
    source: RssSource,
    declaredUrls: ReadonlySet<string>
): boolean {
    return (
        source.path !== null && declaredUrls.has(`${SITE_URL}${source.path}`)
    );
}

/**
 * 소스 하나를 항목으로 만든다. 다음 중 하나라도 없으면 `null`이다 — 날짜를 지어내지 않는다.
 *
 * - 본문(페이지가 읽는 reader의 결과)
 * - 스탬프, 그리고 `hashHubBody(body)`가 현재 또는 직전 스탬프 해시와 같을 것 — 크론이 **이 정확한 본문**을 확인한
 *   적이 있어야 `stamp.at`이 "이 글이 처음 나타난 시각"이다. 해시가 다르면 페이지는 크론이
 *   본 적 없는 본문(다른 키의 캐시)을 보여 주는 중이라 그 시각은 이 글의 것이 아니다.
 * - 정적 sitemap에 실린 허브 — 색인 대상이 아닌 페이지를 구독 대상으로 내놓지 않는다.
 */
export async function buildRssItem(
    source: RssSource,
    declaredUrls: ReadonlySet<string>
): Promise<RssItem | null> {
    if (source.path === null || !isEligibleRssSource(source, declaredUrls))
        return null;
    const link = `${SITE_URL}${source.path}`;

    const read = await source.read();
    if (read === null) return null;
    const stamp = await readHubContentStamp(source.surface);
    if (stamp === null) return null;
    // 크론이 새 스탬프를 쓴 직후에는 reader가 아직 이전 본문을 돌려준다. 직전 스탬프와
    // 맞으면 그 항목(같은 guid·pubDate)을 그대로 싣는다 — 그렇지 않으면 새 본문이 캐시에
    // 들어올 때까지 항목이 피드에서 빠진다.
    const matched = matchHubContentStamp(stamp, hashHubBody(read.body));
    if (matched === null) return null;

    const pubDate = new Date(matched.at);
    if (Number.isNaN(pubDate.getTime())) return null;
    const description = toDescription(read.prose);
    if (description === '') return null;

    return {
        title: rssItemTitle(source.title, pubDate),
        link,
        guid: `${link}#${matched.hash.slice(0, GUID_HASH_LENGTH)}`,
        pubDate,
        description,
        paragraphs: toParagraphs(read.prose),
    };
}
