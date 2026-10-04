import { describe, expect, it } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { buildCryptoPopularEntries } from '../lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '../lib/buildPopularEntries';
import { selectIndexNowUrls } from '../lib/indexNowUrls';
import type { SitemapEntry } from '../model';

const NOW = new Date('2026-10-04T12:00:00Z');

// AAPL·005930.KS·BTCUSD는 큐레이션 목록 멤버다. MSFT는 목록 멤버지만 뉴스 산문이
// 없는 것으로 둬서 sitemap 빌더가 `/MSFT/news`를 싣지 않게 한다.
const symbolTabsWithProse = new Set(['AAPL:news', '005930.KS:news']);

const popularEntries = buildPopularEntries(NOW, { symbolTabsWithProse });
const cryptoEntries = buildCryptoPopularEntries(NOW, { symbolTabsWithProse });
const allEntries = [...popularEntries, ...cryptoEntries];

describe('selectIndexNowUrls', () => {
    it('심볼의 sitemap 엔트리 URL만 돌려준다(차트·뉴스·공포탐욕)', () => {
        expect(selectIndexNowUrls(['AAPL'], allEntries)).toEqual([
            `${SITE_URL}/AAPL`,
            `${SITE_URL}/AAPL/news`,
            `${SITE_URL}/AAPL/fear-greed`,
        ]);
    });

    it('sitemap이 싣지 않은 탭은 제출하지 않는다 — 산문 게이트를 통과하지 못한 뉴스 탭', () => {
        const urls = selectIndexNowUrls(['MSFT'], allEntries);

        expect(urls).toContain(`${SITE_URL}/MSFT`);
        expect(urls).toContain(`${SITE_URL}/MSFT/fear-greed`);
        expect(urls).not.toContain(`${SITE_URL}/MSFT/news`);
    });

    it('항상 noindex인 탭(종합·펀더멘털·재무·옵션·의회·내위치)은 어떤 경우에도 나오지 않는다', () => {
        const urls = selectIndexNowUrls(['AAPL', 'BTCUSD'], allEntries);

        for (const tab of [
            'overall',
            'fundamental',
            'financials',
            'options',
            'congress',
            'position',
        ]) {
            expect(urls.some(url => url.endsWith(`/${tab}`))).toBe(false);
        }
    });

    it('점이 든 한국 심볼도 첫 세그먼트로 정확히 매치한다', () => {
        expect(selectIndexNowUrls(['005930.KS'], allEntries)).toEqual([
            `${SITE_URL}/005930.KS`,
            `${SITE_URL}/005930.KS/news`,
            `${SITE_URL}/005930.KS/fear-greed`,
        ]);
    });

    it('심볼 비교는 대소문자를 구분하지 않는다', () => {
        expect(selectIndexNowUrls(['aapl'], allEntries)).toEqual(
            selectIndexNowUrls(['AAPL'], allEntries)
        );
    });

    it('크립토 엔트리도 같은 방식으로 고른다', () => {
        const urls = selectIndexNowUrls(['BTCUSD'], allEntries);

        expect(urls).toContain(`${SITE_URL}/BTCUSD`);
        expect(urls).toContain(`${SITE_URL}/BTCUSD/fear-greed`);
        expect(urls.every(url => url.includes('/BTCUSD'))).toBe(true);
    });

    it('접두사만 같은 다른 심볼은 끌어오지 않는다(BTC ≠ BTCUSD)', () => {
        expect(selectIndexNowUrls(['BTC'], allEntries)).toEqual([]);
    });

    it('엔트리에 없는 심볼은 아무것도 만들어내지 않는다', () => {
        expect(selectIndexNowUrls(['ZZZZ-NOT-LISTED'], allEntries)).toEqual([]);
    });

    it('심볼이 비어 있으면 빈 배열이다', () => {
        expect(selectIndexNowUrls([], allEntries)).toEqual([]);
    });

    it('여러 심볼은 엔트리 순서대로 한 번씩만 나온다', () => {
        const urls = selectIndexNowUrls(['BTCUSD', 'AAPL', 'AAPL'], allEntries);

        expect(new Set(urls).size).toBe(urls.length);
        expect(urls.indexOf(`${SITE_URL}/AAPL`)).toBeLessThan(
            urls.indexOf(`${SITE_URL}/BTCUSD`)
        );
    });

    it('파싱할 수 없는 URL의 엔트리는 건너뛴다', () => {
        const broken: SitemapEntry = {
            url: 'not a url',
            lastModified: NOW,
            changeFrequency: 'daily',
            priority: 0.5,
        };

        expect(
            selectIndexNowUrls(['AAPL'], [broken, ...popularEntries])
        ).toEqual(selectIndexNowUrls(['AAPL'], popularEntries));
    });
});
