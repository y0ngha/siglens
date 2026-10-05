/**
 * noindex `[symbol]` 메타데이터의 canonical 계약 (2026-10-05).
 *
 * 예전에는 `NOINDEX_SYMBOL_METADATA`가 `canonical: null`을 담아, 차단된 심볼 페이지가 canonical
 * 신호 없이 나갔다. 항상-noindex 탭(`ALWAYS_NOINDEX_TAB_ROBOTS`)과 같은 방식 — **자기 URL을 가리키는
 * self-canonical** — 으로 통일했다. 루트 레이아웃의 홈 canonical 상속은 계속 막아야 한다.
 */
import { getTranslations } from 'next-intl/server';
import {
    NOINDEX_SYMBOL_METADATA,
    noindexInvalidSymbolMetadata,
    noindexSymbolMetadata,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';

let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

describe('NOINDEX_SYMBOL_METADATA', () => {
    it('robots만 담는다 — canonical은 호출부가 자기 URL로 정한다', () => {
        expect(NOINDEX_SYMBOL_METADATA).toEqual({
            robots: { index: false, follow: true },
        });
        expect(NOINDEX_SYMBOL_METADATA.alternates).toBeUndefined();
    });
});

describe('noindexSymbolMetadata', () => {
    it('self-canonical이고 홈도 null도 아니다(탭 경로까지 자기 URL)', () => {
        const root = noindexSymbolMetadata('aapl', t, 'ko');
        const news = noindexSymbolMetadata('aapl', t, 'ko', { tab: 'news' });

        expect(root.alternates).toEqual({ canonical: `${SITE_URL}/AAPL` });
        expect(news.alternates).toEqual({ canonical: `${SITE_URL}/AAPL/news` });
        expect(root.robots).toEqual({ index: false, follow: true });
    });

    it('로케일 접두사가 붙은 URL을 가리키고 hreflang 군집은 싣지 않는다', () => {
        const en = noindexSymbolMetadata('aapl', t, 'en');

        expect(en.alternates).toEqual({ canonical: `${SITE_URL}/en/AAPL` });
        expect(en.alternates).not.toHaveProperty('languages');
    });

    it('og:url과 canonical이 같다 — 자기 정체성만 말한다', () => {
        const meta = noindexSymbolMetadata('aapl', t, 'ko', { tab: 'news' });

        expect(meta.alternates?.canonical).toBe(meta.openGraph?.url);
    });
});

describe('noindexInvalidSymbolMetadata', () => {
    it('심볼이 아닌 세그먼트도 canonical은 실제 요청 URL이다(홈 상속 아님)', () => {
        const meta = noindexInvalidSymbolMetadata('!!!invalid', 'ko');

        expect(meta.robots).toEqual({ index: false, follow: true });
        expect(meta.alternates).toEqual({
            canonical: `${SITE_URL}/!!!invalid`,
        });
    });

    it('탭 라우트는 탭 꼬리까지 실제 요청 경로를 canonical로 낸다(루트 URL이 아니다)', () => {
        const news = noindexInvalidSymbolMetadata('!!!', 'ko', 'news');
        const fearGreed = noindexInvalidSymbolMetadata(
            'a b',
            'en',
            'fear-greed'
        );

        expect(news.alternates).toEqual({ canonical: `${SITE_URL}/!!!/news` });
        expect(fearGreed.alternates).toEqual({
            canonical: `${SITE_URL}/en/a%20b/fear-greed`,
        });
    });

    it('탭 꼬리를 생략하면 심볼 루트다', () => {
        expect(noindexInvalidSymbolMetadata('!!!', 'ko').alternates).toEqual({
            canonical: `${SITE_URL}/!!!`,
        });
    });

    it('경로를 깨는 문자는 인코딩하고 로케일 접두사를 붙인다', () => {
        const meta = noindexInvalidSymbolMetadata('a/b?c', 'en');

        expect(meta.alternates?.canonical).toBe(`${SITE_URL}/en/a%2Fb%3Fc`);
    });
});
