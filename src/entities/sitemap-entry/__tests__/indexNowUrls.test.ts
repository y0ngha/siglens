import { describe, expect, it } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { buildCryptoPopularEntries } from '../lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '../lib/buildPopularEntries';
import type { SitemapEntry } from '../model';
import { selectIndexNowUrls } from '../lib/indexNowUrls';

const NOW = new Date('2026-10-04T12:00:00Z');

function entry(url: string): SitemapEntry {
    return { url, changeFrequency: 'daily', priority: 0.8 };
}

const AAPL_ENTRIES = [
    entry('https://siglens.io/AAPL'),
    entry('https://siglens.io/AAPL/news'),
    entry('https://siglens.io/AAPL/fear-greed'),
];

describe('selectIndexNowUrls', () => {
    it('harvest된 탭의 URL만 돌려준다 — 차트만 굽혔으면 뉴스·공포탐욕은 나가지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical'] }],
                AAPL_ENTRIES
            )
        ).toEqual(['https://siglens.io/AAPL']);
    });

    it('뉴스만 harvest되면 뉴스 URL만', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['news'] }],
                AAPL_ENTRIES
            )
        ).toEqual(['https://siglens.io/AAPL/news']);
    });

    it('두 탭 모두 harvest되면 차트·뉴스(공포탐욕은 프리웜 탭이 아니라 제외)', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical', 'news'] }],
                AAPL_ENTRIES
            )
        ).toEqual(['https://siglens.io/AAPL', 'https://siglens.io/AAPL/news']);
    });

    it('sitemap이 싣지 않은 탭(산문 게이트 미통과 뉴스)은 제출하지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical', 'news'] }],
                [entry('https://siglens.io/AAPL')]
            )
        ).toEqual(['https://siglens.io/AAPL']);
    });

    it('항상 noindex인 탭은 sitemap에 없으므로 어떤 경우에도 나오지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [
                    {
                        symbol: 'AAPL',
                        tabs: [
                            'overall',
                            'fundamental',
                            'financials',
                            'options',
                        ],
                    },
                ],
                AAPL_ENTRIES
            )
        ).toEqual([]);
    });

    it('점이 든 한국 심볼도 정확히 매치한다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: '005930.KS', tabs: ['technical'] }],
                [
                    entry('https://siglens.io/005930.KS'),
                    entry('https://siglens.io/005930.KS/news'),
                ]
            )
        ).toEqual(['https://siglens.io/005930.KS']);
    });

    it('심볼 비교는 대소문자를 구분하지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'aapl', tabs: ['technical'] }],
                [entry('https://siglens.io/AAPL')]
            )
        ).toEqual(['https://siglens.io/AAPL']);
    });

    it('접두사만 같은 다른 심볼은 끌어오지 않는다(BTC ≠ BTCUSD)', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'BTC', tabs: ['technical'] }],
                [
                    entry('https://siglens.io/BTCUSD'),
                    entry('https://siglens.io/BTC'),
                ]
            )
        ).toEqual(['https://siglens.io/BTC']);
    });

    it('엔트리에 없는 심볼은 아무것도 만들어내지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'ZZZZ', tabs: ['technical', 'news'] }],
                AAPL_ENTRIES
            )
        ).toEqual([]);
    });

    it('여러 심볼은 엔트리 순서대로 한 번씩만 나온다', () => {
        expect(
            selectIndexNowUrls(
                [
                    { symbol: 'TSLA', tabs: ['technical'] },
                    { symbol: 'AAPL', tabs: ['technical'] },
                    { symbol: 'AAPL', tabs: ['technical'] },
                ],
                [
                    entry('https://siglens.io/AAPL'),
                    entry('https://siglens.io/TSLA'),
                ]
            )
        ).toEqual(['https://siglens.io/AAPL', 'https://siglens.io/TSLA']);
    });

    it('파싱할 수 없는 URL의 엔트리는 건너뛴다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical'] }],
                [entry('not a url'), entry('https://siglens.io/AAPL')]
            )
        ).toEqual(['https://siglens.io/AAPL']);
    });

    it('harvest가 비면 빈 배열', () => {
        expect(selectIndexNowUrls([], AAPL_ENTRIES)).toEqual([]);
    });
});

/**
 * 실제 sitemap 빌더가 만든 엔트리로 검증한다 — 손으로 만든 엔트리는 빌더의 산문 게이트를 건너뛴다.
 */
describe('selectIndexNowUrls — 실제 sitemap 빌더 엔트리', () => {
    // AAPL·005930.KS·BTCUSD는 큐레이션 목록 멤버다. 차트(technical)도 산문 게이트 대상이라
    // 키가 있어야 차트 URL이 실린다. MSFT·BTCUSD는 목록 멤버지만 뉴스 산문이
    // 없는 것으로 둬서 sitemap 빌더가 `/MSFT/news`를 싣지 않게 한다.
    const snapshotGeneratedAt = new Map<string, Date>([
        ['AAPL:news', NOW],
        ['AAPL:technical', NOW],
        ['005930.KS:news', NOW],
        ['005930.KS:technical', NOW],
        ['MSFT:technical', NOW],
        ['BTCUSD:technical', NOW],
    ]);

    const popularEntries = buildPopularEntries(NOW, { snapshotGeneratedAt });
    const cryptoEntries = buildCryptoPopularEntries(NOW, {
        snapshotGeneratedAt,
    });
    const allEntries = [...popularEntries, ...cryptoEntries];

    it('차트만 harvest된 AAPL은 차트 URL만 — 뉴스·공포탐욕은 나가지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical'] }],
                allEntries
            )
        ).toEqual([`${SITE_URL}/AAPL`]);
    });

    it('뉴스 산문이 없는 MSFT는 뉴스가 harvest됐다고 해도 sitemap에 없어 나오지 않는다', () => {
        expect(
            selectIndexNowUrls(
                [{ symbol: 'MSFT', tabs: ['technical', 'news'] }],
                allEntries
            )
        ).toEqual([`${SITE_URL}/MSFT`]);
    });

    it('차트 산문 키가 없는 심볼은 차트가 harvest돼도 나오지 않는다(산문 게이트)', () => {
        const noChartProse = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([['AAPL:news', NOW]]),
        });

        expect(
            selectIndexNowUrls(
                [{ symbol: 'AAPL', tabs: ['technical', 'news'] }],
                noChartProse
            )
        ).toEqual([`${SITE_URL}/AAPL/news`]);
    });

    it('한국·크립토 심볼도 같은 방식으로 고른다', () => {
        expect(
            selectIndexNowUrls(
                [
                    { symbol: '005930.KS', tabs: ['technical', 'news'] },
                    { symbol: 'BTCUSD', tabs: ['technical'] },
                ],
                allEntries
            ).toSorted()
        ).toEqual(
            [
                `${SITE_URL}/005930.KS`,
                `${SITE_URL}/005930.KS/news`,
                `${SITE_URL}/BTCUSD`,
            ].toSorted()
        );
    });
});
