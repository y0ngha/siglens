import { escapeXml } from '@/entities/sitemap-entry/lib/xml';
import type { RssChannel, RssItem } from '../model';

/**
 * XML 1.0이 허용하지 않는 제어 문자(탭·개행·캐리지리턴 제외)와 비문자 코드 포인트.
 *
 * 하나라도 남으면 문서 전체가 파싱 실패한다 — 리더가 피드를 통째로 버린다. 산문은 LLM
 * 출력이라 어떤 문자가 섞일지 보장할 수 없어 출력단에서 강제한다.
 */
const XML_ILLEGAL_CHARS =
    // eslint-disable-next-line no-control-regex -- XML 1.0이 허용하지 않는 제어 문자를 지우는 것이 이 정규식의 목적이다
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function text(value: string): string {
    return escapeXml(value.replace(XML_ILLEGAL_CHARS, ''));
}

/** RFC 822 날짜. `toUTCString()`이 `Sun, 04 Oct 2026 01:30:00 GMT` 형태를 준다. */
function rfc822(date: Date): string {
    return date.toUTCString();
}

function itemXml(item: RssItem): string {
    return `    <item>
      <title>${text(item.title)}</title>
      <link>${text(item.link)}</link>
      <guid isPermaLink="false">${text(item.guid)}</guid>
      <pubDate>${rfc822(item.pubDate)}</pubDate>
      <description>${text(item.description)}</description>
    </item>`;
}

/**
 * RSS 2.0 문서를 만든다. 순수 함수 — 문구(한국어 제목 등)는 호출부가 넘긴다.
 *
 * 항목은 최신순으로 정렬하고 `lastBuildDate`는 가장 새 항목의 `pubDate`다. 항목이 없으면
 * `lastBuildDate`를 **내지 않는다** — 빌드 시각을 쓰면 내용이 없는데 "방금 갱신됨"을
 * 주장하는 피드가 된다. 빈 피드도 채널은 유효하다.
 */
export function buildRssXml(channel: RssChannel): string {
    const items = channel.items.toSorted(
        (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
    );
    const newest = items[0];
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>${text(channel.title)}</title>`,
        `    <link>${text(channel.link)}</link>`,
        `    <description>${text(channel.description)}</description>`,
        `    <language>${text(channel.language)}</language>`,
        `    <atom:link href="${text(channel.selfUrl)}" rel="self" type="application/rss+xml"/>`,
        ...(newest
            ? [`    <lastBuildDate>${rfc822(newest.pubDate)}</lastBuildDate>`]
            : []),
        ...items.map(itemXml),
        '  </channel>',
        '</rss>',
    ];
    return `${lines.join('\n')}\n`;
}
