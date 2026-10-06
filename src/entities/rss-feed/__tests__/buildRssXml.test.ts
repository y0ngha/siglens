import { describe, expect, it } from 'vitest';
import { buildRssXml } from '../lib/buildRssXml';
import type { RssChannel, RssItem } from '../model';

function item(overrides: Partial<RssItem> = {}): RssItem {
    return {
        title: '미국 시장 브리핑',
        link: 'https://siglens.io/market',
        guid: 'https://siglens.io/market#abcdef012345',
        pubDate: new Date('2026-10-04T01:30:00.000Z'),
        description: '지수는 상승했습니다.',
        ...overrides,
    };
}

function channel(items: readonly RssItem[] = [item()]): RssChannel {
    return {
        title: 'Siglens 시장 브리핑',
        link: 'https://siglens.io',
        description: '시장 브리핑과 뉴스 요약',
        language: 'ko',
        selfUrl: 'https://siglens.io/rss.xml',
        items,
    };
}

/** 태그 본문을 꺼낸다. 정규식으로 충분한 단순한 구조만 쓴다. */
function between(xml: string, tag: string): string[] {
    return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g'))]
        .map(match => match[1])
        .filter((v): v is string => v !== undefined);
}

describe('buildRssXml', () => {
    it('RSS 2.0 문서와 atom 자기 참조 링크를 낸다', () => {
        const xml = buildRssXml(channel());

        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
            true
        );
        expect(xml).toContain(
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">'
        );
        expect(xml).toContain(
            '<atom:link href="https://siglens.io/rss.xml" rel="self" type="application/rss+xml"/>'
        );
        expect(xml).toContain('<language>ko</language>');
    });

    it('항목의 guid는 isPermaLink="false"다', () => {
        expect(buildRssXml(channel())).toContain(
            '<guid isPermaLink="false">https://siglens.io/market#abcdef012345</guid>'
        );
    });

    it('날짜는 RFC 822(UTC)로 낸다', () => {
        const xml = buildRssXml(channel());

        expect(between(xml, 'pubDate')).toEqual([
            'Sun, 04 Oct 2026 01:30:00 GMT',
        ]);
        expect(between(xml, 'lastBuildDate')).toEqual([
            'Sun, 04 Oct 2026 01:30:00 GMT',
        ]);
    });

    it('항목은 최신순이고 lastBuildDate는 가장 새 항목의 시각이다', () => {
        const older = item({
            title: '오래된',
            guid: 'g-old',
            pubDate: new Date('2026-10-03T00:00:00.000Z'),
        });
        const newest = item({
            title: '최신',
            guid: 'g-new',
            pubDate: new Date('2026-10-04T09:00:00.000Z'),
        });
        const middle = item({
            title: '중간',
            guid: 'g-mid',
            pubDate: new Date('2026-10-04T01:00:00.000Z'),
        });

        const xml = buildRssXml(channel([older, newest, middle]));

        expect(between(xml, 'guid')).toEqual(['g-new', 'g-mid', 'g-old']);
        expect(between(xml, 'lastBuildDate')).toEqual([
            'Sun, 04 Oct 2026 09:00:00 GMT',
        ]);
    });

    it('빈 피드도 채널은 있고 항목과 lastBuildDate가 없다', () => {
        const xml = buildRssXml(channel([]));

        expect(xml).toContain('<channel>');
        expect(xml).toContain('<title>Siglens 시장 브리핑</title>');
        expect(xml).not.toContain('<item>');
        expect(xml).not.toContain('lastBuildDate');
        expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
    });

    it('모든 텍스트에서 & < > " \' 를 이스케이프한다', () => {
        const xml = buildRssXml(
            channel([
                item({
                    title: `A & B <c> "d" 'e'`,
                    description: `x < y && z > "w"`,
                }),
            ])
        );

        expect(xml).toContain(
            '<title>A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;</title>'
        );
        expect(xml).toContain(
            '<description>x &lt; y &amp;&amp; z &gt; &quot;w&quot;</description>'
        );
    });

    it('채널 제목·링크·설명과 링크·guid도 이스케이프한다', () => {
        const xml = buildRssXml({
            ...channel([
                item({
                    link: 'https://siglens.io/a?x=1&y=2',
                    guid: 'https://siglens.io/a?x=1&y=2#h',
                }),
            ]),
            title: 'T & U',
            description: '<d>',
        });

        expect(xml).toContain('<title>T &amp; U</title>');
        expect(xml).toContain('<description>&lt;d&gt;</description>');
        expect(xml).toContain('<link>https://siglens.io/a?x=1&amp;y=2</link>');
        expect(xml).toContain(
            '<guid isPermaLink="false">https://siglens.io/a?x=1&amp;y=2#h</guid>'
        );
    });

    it('XML 1.0에서 허용되지 않는 제어 문자와 U+FFFE·U+FFFF는 제거하고 탭·개행은 둔다', () => {
        const xml = buildRssXml(
            channel([
                item({
                    description:
                        'a\u0000b\u0008c\u000Bd\te\nf\u001Fg\uFFFEh\uFFFFi\u0085j',
                }),
            ])
        );

        expect(xml).toContain('<description>abcd\te\nfghij</description>');
        expect(xml).not.toMatch(/[^\P{Cc}\t\n\r]|[\uFFFE\uFFFF]/u);
    });

    it('한글은 그대로 UTF-8로 낸다', () => {
        expect(buildRssXml(channel())).toContain(
            '<title>미국 시장 브리핑</title>'
        );
    });

    describe('content:encoded', () => {
        it('문단을 <p>로 감싼 HTML을 CDATA에 담는다', () => {
            const xml = buildRssXml(
                channel([
                    item({
                        paragraphs: ['첫 문단입니다.', '둘째 문단입니다.'],
                    }),
                ])
            );

            expect(xml).toContain(
                '<content:encoded><![CDATA[<p>첫 문단입니다.</p><p>둘째 문단입니다.</p>]]></content:encoded>'
            );
        });

        it('HTML 특수문자는 이스케이프한다 — `>`도 바꾸므로 CDATA를 닫는 `]]>`가 생기지 않는다', () => {
            const xml = buildRssXml(
                channel([item({ paragraphs: ['a < b & c ]]> d'] })])
            );

            expect(xml).toContain('<p>a &lt; b &amp; c ]]&gt; d</p>');
            expect(xml.match(/\]\]>/g)).toHaveLength(1);
        });

        it('문단이 없거나 전부 비면 요소를 내지 않는다', () => {
            expect(buildRssXml(channel([item()]))).not.toContain(
                'content:encoded'
            );
            expect(
                buildRssXml(channel([item({ paragraphs: ['  ', ''] })]))
            ).not.toContain('content:encoded');
        });
    });
});
