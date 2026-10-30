import { mergeNaverNewsBatches } from '../mergeNaverNewsBatches';

const CUTOFF = new Date('2026-06-09T00:00:00Z');

function article(url: string, pubDate: string, title = `제목 ${url}`) {
    return { title, originallink: url, link: `https://n.news/${url}`, pubDate };
}

describe('mergeNaverNewsBatches는', () => {
    it('질의 사이에서 같은 기사를 한 번만 남기고 앞선 질의가 이긴다', () => {
        const merged = mergeNaverNewsBatches(
            [
                [article('https://x/1', 'Mon, 15 Jun 2026 10:00:00 GMT', '앞')],
                [article('https://x/1', 'Mon, 15 Jun 2026 10:00:00 GMT', '뒤')],
            ],
            '__NEWS_KR__',
            CUTOFF
        );

        expect(merged.map(i => i.titleEn)).toEqual(['앞']);
    });

    it('lookback 밖 기사와 정규화 불가 기사를 버린다', () => {
        const merged = mergeNaverNewsBatches(
            [
                [
                    article('https://x/old', 'Mon, 01 Jun 2026 10:00:00 GMT'),
                    article('https://x/ok', 'Mon, 15 Jun 2026 10:00:00 GMT'),
                    {
                        title: '링크 없음',
                        pubDate: 'Mon, 15 Jun 2026 10:00:00 GMT',
                    },
                ],
            ],
            '__NEWS_KR__',
            CUTOFF
        );

        expect(merged.map(i => i.url)).toEqual(['https://x/ok']);
    });

    it('최신순으로 정렬하고 sentinel을 붙이며 tickers를 비운다', () => {
        const merged = mergeNaverNewsBatches(
            [
                [
                    article('https://x/early', 'Mon, 15 Jun 2026 09:00:00 GMT'),
                    article('https://x/late', 'Mon, 15 Jun 2026 12:00:00 GMT'),
                ],
            ],
            '__NEWS_KR__',
            CUTOFF
        );

        expect(merged.map(i => i.url)).toEqual([
            'https://x/late',
            'https://x/early',
        ]);
        expect(merged[0]).toMatchObject({ symbol: '__NEWS_KR__', tickers: [] });
    });
});
