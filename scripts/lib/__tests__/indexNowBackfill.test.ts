import { describe, expect, it } from 'vitest';
import {
    ALWAYS_NOINDEX_TABS,
    BACKFILL_CHUNK_SIZE,
    REMOVED_C_SEGMENT_TICKERS,
    alwaysNoindexTabUrls,
    chunkUrls,
    formatUrlList,
    normalizeBackfillUrls,
    parseBackfillArgs,
    parseFromChunk,
    parseSitemapLocs,
    parseUrlList,
    removalSitemapUrl,
    removedSegmentUrls,
} from '../indexNowBackfill';

describe('parseSitemapLocs', () => {
    it('<loc>을 모두 뽑고 XML 엔티티를 푼다', () => {
        const xml = `<?xml version="1.0"?><urlset>
            <url><loc>https://siglens.io/A</loc><lastmod>2026-10-01</lastmod></url>
            <url><loc>
                https://siglens.io/B?x=1&amp;y=2
            </loc></url></urlset>`;

        expect(parseSitemapLocs(xml)).toEqual([
            'https://siglens.io/A',
            'https://siglens.io/B?x=1&y=2',
        ]);
    });

    it('<loc>이 없으면 빈 배열', () => {
        expect(parseSitemapLocs('<urlset></urlset>')).toEqual([]);
    });
});

describe('백필 URL 집합', () => {
    it('C 구간은 정확히 43종이고 서로 겹치지 않는다', () => {
        expect(REMOVED_C_SEGMENT_TICKERS).toHaveLength(43);
        expect(new Set(REMOVED_C_SEGMENT_TICKERS).size).toBe(43);
    });

    it('항상-noindex 탭은 여섯 개다', () => {
        expect(ALWAYS_NOINDEX_TABS).toEqual([
            'overall',
            'fundamental',
            'financials',
            'congress',
            'options',
            'position',
        ]);
    });

    it('C 구간 종목은 차트·뉴스·공포탐욕 + 옛 noindex 탭 6종(총 9개 URL)을 낸다', () => {
        const urls = removedSegmentUrls();

        expect(urls).toHaveLength(43 * 9);
        expect(urls).toContain('https://siglens.io/QSPT');
        expect(urls).toContain('https://siglens.io/QSPT/news');
        expect(urls).toContain('https://siglens.io/LENZ/position');
    });

    it('큐레이션 종목마다 항상-noindex 탭 6종 URL을 낸다(대문자화)', () => {
        expect(alwaysNoindexTabUrls(['aapl', 'BTCUSD'])).toEqual([
            ...ALWAYS_NOINDEX_TABS.map(t => `https://siglens.io/AAPL/${t}`),
            ...ALWAYS_NOINDEX_TABS.map(t => `https://siglens.io/BTCUSD/${t}`),
        ]);
    });

    it('removal sitemap URL은 kind별 운영 경로', () => {
        expect(removalSitemapUrl('chart')).toBe(
            'https://siglens.io/api/sitemap/removal/chart'
        );
    });
});

describe('normalizeBackfillUrls / chunkUrls', () => {
    it('중복과 타 호스트·파싱 불가 URL을 걸러 순서를 유지한다', () => {
        expect(
            normalizeBackfillUrls([
                'https://siglens.io/A',
                'https://siglens.io/A',
                'https://example.com/B',
                'garbage',
                'https://siglens.io/C',
            ])
        ).toEqual(['https://siglens.io/A', 'https://siglens.io/C']);
    });

    it('10,000개 단위로 청크를 나눈다', () => {
        const urls = Array.from(
            { length: BACKFILL_CHUNK_SIZE * 2 + 1 },
            (_, i) => `https://siglens.io/S${i}`
        );

        const chunks = chunkUrls(urls, BACKFILL_CHUNK_SIZE);

        expect(chunks.map(c => c.length)).toEqual([10_000, 10_000, 1]);
    });

    it('빈 입력은 청크가 없다', () => {
        expect(chunkUrls([], 10)).toEqual([]);
    });
});

describe('parseFromChunk', () => {
    it.each([
        [undefined, 1],
        ['3', 3],
    ])('%s → %s', (raw, expected) => {
        expect(parseFromChunk(raw)).toBe(expected);
    });

    it.each(['0', '-1', 'x', '1.5', ''])('%j는 거부한다', raw => {
        expect(parseFromChunk(raw)).toBeNull();
    });
});

describe('parseUrlList / formatUrlList (--save · --from-file)', () => {
    it('한 줄에 하나씩 읽고 빈 줄·# 주석·공백을 건너뛴다', () => {
        const text = [
            '# saved 2026-10-05',
            '',
            '  https://siglens.io/A  ',
            'https://siglens.io/B',
            '\r',
        ].join('\n');

        expect(parseUrlList(text)).toEqual([
            'https://siglens.io/A',
            'https://siglens.io/B',
        ]);
    });

    it('중복·타 호스트·파싱 불가 줄을 걸러 첫 등장 순서를 유지한다', () => {
        expect(
            parseUrlList(
                [
                    'https://siglens.io/B',
                    'https://siglens.io/A',
                    'https://siglens.io/B',
                    'https://example.com/C',
                    'garbage',
                ].join('\n')
            )
        ).toEqual(['https://siglens.io/B', 'https://siglens.io/A']);
    });

    it('저장했다 읽으면 같은 목록이다(왕복) — 청크 번호가 안정적이다', () => {
        const urls = Array.from(
            { length: 25 },
            (_, i) => `https://siglens.io/S${i}`
        );

        const reloaded = parseUrlList(formatUrlList(urls));

        expect(reloaded).toEqual(urls);
        expect(chunkUrls(reloaded, 10).map(c => c.length)).toEqual([10, 10, 5]);
        // 3번째 청크부터 재개하면 같은 마지막 5개가 나온다.
        expect(chunkUrls(reloaded, 10)[2]).toEqual(urls.slice(20));
    });

    it('빈 목록은 빈 문자열로 저장되고 다시 빈 목록이다', () => {
        expect(formatUrlList([])).toBe('');
        expect(parseUrlList('')).toEqual([]);
    });
});

describe('parseBackfillArgs', () => {
    it('기본은 dry-run이다 — 제출·저장·파일 없음', () => {
        expect(parseBackfillArgs([])).toEqual({
            submit: false,
            fromChunk: 1,
            saveFile: null,
            fromFile: null,
        });
    });

    it('--submit --from-file --from-chunk를 함께 읽는다', () => {
        expect(
            parseBackfillArgs([
                '--submit',
                '--from-file',
                'urls.txt',
                '--from-chunk',
                '3',
            ])
        ).toEqual({
            submit: true,
            fromChunk: 3,
            saveFile: null,
            fromFile: 'urls.txt',
        });
    });

    it('--save는 파일 경로를 읽고 제출 모드가 아니다', () => {
        expect(parseBackfillArgs(['--save', 'urls.txt'])).toMatchObject({
            submit: false,
            saveFile: 'urls.txt',
        });
    });

    it.each([
        [['--save']],
        [['--save', '--submit']],
        [['--from-file']],
        [['--from-chunk', '0']],
        [['--from-chunk']],
        [['--save', 'urls.txt', '--submit']],
    ])('잘못된 인자 %j는 error를 돌려준다', argv => {
        expect(parseBackfillArgs(argv)).toHaveProperty('error');
    });
});
