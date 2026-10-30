import {
    isHttpUrl,
    newsHtml,
    newsLines,
} from '@/entities/email-report/templates/newsSection';
import type { SymbolReportNews } from '@/entities/email-report/reportModel';

const t = (key: string): string => key;

const NEWS: SymbolReportNews = {
    title: 'Title <x>',
    summary: '요약',
    sentiment: 'bullish',
    url: 'https://news.example.com/a',
    source: 'Reuters',
    publishedAt: '2026-10-07T00:00:00Z',
};

describe('isHttpUrl', () => {
    it.each([
        ['http://a.com', true],
        ['HTTPS://a.com', true],
        ['javascript:alert(1)', false],
        ['/relative', false],
    ])('%s -> %s', (url, expected) => {
        expect(isHttpUrl(url)).toBe(expected);
    });
});

describe('newsHtml', () => {
    it('기사가 없으면 빈 문자열', () => {
        expect(newsHtml([], t)).toBe('');
    });

    it('http(s) 기사는 링크로 걸고 제목을 이스케이프한다', () => {
        const html = newsHtml([NEWS], t);

        expect(html).toContain('<a href="https://news.example.com/a"');
        expect(html).toContain('Title &lt;x&gt;');
        expect(html).toContain('[sentiment.bullish]');
    });

    it('다른 스킴은 링크 없이 텍스트로만 싣는다', () => {
        const html = newsHtml([{ ...NEWS, url: 'javascript:alert(1)' }], t);

        expect(html).not.toContain('<a ');
        expect(html).not.toContain('javascript:');
        expect(html).toContain('Title &lt;x&gt;');
    });

    it.each([
        ['bullish', '#26a69a'],
        ['bearish', '#ef5350'],
        ['neutral', '#94a3b8'],
    ] as const)('%s 감성은 %s 색 라벨', (sentiment, color) => {
        expect(newsHtml([{ ...NEWS, sentiment }], t)).toContain(
            `color:${color};font-weight:600;">[sentiment.${sentiment}]`
        );
    });

    it('감성이 없으면 라벨을 달지 않는다', () => {
        expect(newsHtml([{ ...NEWS, sentiment: null }], t)).not.toContain(
            'sentiment.'
        );
    });

    it('요약이 없으면 요약 줄을 만들지 않는다', () => {
        expect(newsHtml([{ ...NEWS, summary: null }], t)).not.toContain(
            'margin-top:2px'
        );
    });
});

describe('newsLines', () => {
    it('기사가 없으면 빈 배열', () => {
        expect(newsLines([], t)).toEqual([]);
    });

    it('제목 줄 뒤에 http(s) URL과 요약을 들여쓴다', () => {
        expect(newsLines([NEWS], t)).toEqual([
            '',
            '[sectionNews]',
            '- Title <x> (Reuters)',
            '  https://news.example.com/a',
            '  요약',
        ]);
    });

    it('http(s)가 아닌 URL과 없는 요약은 줄을 만들지 않는다', () => {
        expect(
            newsLines([{ ...NEWS, url: 'ftp://a', summary: null }], t)
        ).toEqual(['', '[sectionNews]', '- Title <x> (Reuters)']);
    });
});
