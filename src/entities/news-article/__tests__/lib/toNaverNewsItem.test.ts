import { toNaverNewsItem } from '../../lib/toNaverNewsItem';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';

const RAW = {
    title: '<b>삼성전자</b>, 3분기 영업이익 발표',
    originallink: 'https://news.example.com/article/1',
    link: 'https://n.news.naver.com/article/1',
    description: '삼성전자가 &quot;호실적&quot;을 기록했다고 <b>발표</b>했다.',
    pubDate: 'Fri, 14 Aug 2026 15:30:00 +0900',
};

describe('toNaverNewsItem', () => {
    it('원문 링크를 id 해시와 url에 우선 쓴다', () => {
        const item = toNaverNewsItem(RAW, '005930.KS');

        expect(item?.url).toBe('https://news.example.com/article/1');
        expect(item?.id).toBe(
            hashUrlToId('https://news.example.com/article/1')
        );
    });

    it('원문 링크가 없으면 네이버 링크로 대체한다', () => {
        const item = toNaverNewsItem(
            { ...RAW, originallink: undefined },
            '005930.KS'
        );

        expect(item?.url).toBe('https://n.news.naver.com/article/1');
    });

    it('호출부가 준 symbol을 DB 버킷 키로 그대로 싣는다', () => {
        expect(toNaverNewsItem(RAW, '005930.KS')?.symbol).toBe('005930.KS');
    });

    it('출처는 "Naver News", 원문 언어는 ko로 고정한다', () => {
        const item = toNaverNewsItem(RAW, '005930.KS');

        expect(item?.source).toBe('Naver News');
        expect(item?.sourceLanguage).toBe('ko');
    });

    it('제목과 요약의 마크업을 걷어 titleEn·bodyEn에 담는다', () => {
        const item = toNaverNewsItem(RAW, '005930.KS');

        expect(item?.titleEn).toBe('삼성전자, 3분기 영업이익 발표');
        expect(item?.bodyEn).toBe('삼성전자가 "호실적"을 기록했다고 발표했다.');
    });

    it('요약이 없으면 bodyEn을 null로 정규화한다', () => {
        const item = toNaverNewsItem(
            { ...RAW, description: undefined },
            '005930.KS'
        );

        expect(item?.bodyEn).toBeNull();
    });

    it('발행일을 ISO 문자열로 바꾼다', () => {
        expect(toNaverNewsItem(RAW, '005930.KS')?.publishedAt).toBe(
            '2026-08-14T06:30:00.000Z'
        );
    });

    it.each([
        ['링크가 둘 다 없으면', { originallink: undefined, link: undefined }],
        ['발행일이 해석되지 않으면', { pubDate: 'not a date' }],
        ['제목이 없으면', { title: undefined }],
    ])('%s 기사를 버린다', (_label, overrides) => {
        expect(
            toNaverNewsItem({ ...RAW, ...overrides }, '005930.KS')
        ).toBeNull();
    });
});
