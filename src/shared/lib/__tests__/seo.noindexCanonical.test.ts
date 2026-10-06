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

describe('noindexSymbolMetadata — 카피 라우팅', () => {
    it('비-기본 로케일 title은 한국어명 대신 영문 법인명을 쓴다(로케일을 빌더로 넘긴다)', async () => {
        const tEn = await getTranslations({
            locale: 'en',
            namespace: 'shared.seo',
        });
        const meta = noindexSymbolMetadata('aapl', tEn, 'en', {
            displayName: 'Apple Inc. (AAPL)',
            koreanName: '애플',
            englishName: 'Apple Inc.',
        });
        const title = (meta.title as { absolute: string }).absolute;

        expect(title).not.toContain('애플');
        expect(title).toContain('Apple');
    });

    it('크립토는 시세 카피 빌더를 쓴다 — 주가 카피가 아니다', () => {
        const crypto = noindexSymbolMetadata('btcusd', t, 'ko', {
            assetClass: 'crypto',
        });
        const equity = noindexSymbolMetadata('btcusd', t, 'ko');
        const cryptoTitle = (crypto.title as { absolute: string }).absolute;

        expect(cryptoTitle).toContain(t('symbol.crypto.titleCore'));
        expect(cryptoTitle).not.toBe(
            (equity.title as { absolute: string }).absolute
        );
    });

    it('크립토 변형이 없는 탭은 equity 빌더로 폴백한다', () => {
        const meta = noindexSymbolMetadata('btcusd', t, 'ko', {
            assetClass: 'crypto',
            tab: 'options',
        });

        expect((meta.title as { absolute: string }).absolute).toContain(
            t('symbol.options.titleCore')
        );
    });

    it('position 탭은 자기 카피·URL을 쓴다 — 차트 탭과 title·description이 다르다', () => {
        const opts = { displayName: '애플, Apple Inc. (AAPL)' } as const;
        const position = noindexSymbolMetadata('aapl', t, 'ko', {
            ...opts,
            tab: 'position',
        });
        const chart = noindexSymbolMetadata('aapl', t, 'ko', opts);

        expect(position.alternates).toEqual({
            canonical: `${SITE_URL}/AAPL/position`,
        });
        expect(position.title).not.toEqual(chart.title);
        expect(position.description).not.toBe(chart.description);
        expect(position.robots).toEqual({ index: false, follow: true });
    });
});

/**
 * 종목 탭은 `twitter-image.tsx`를 두지 않는다 — Next가 `twitter.images`가 없을 때 최종
 * `openGraph.images`(탭의 `opengraph-image.tsx`)로 `twitter:image`를 채운다. 메타데이터가
 * `twitter.images`를 선언하는 순간 그 자동 채움이 꺼져 홈 이미지나 빈 카드가 나간다.
 */
describe('symbolMetadataFromSeo twitter', () => {
    it('twitter에 images 키를 싣지 않는다 — og 이미지 자동 채움에 맡긴다', () => {
        const meta = noindexSymbolMetadata('aapl', t, 'ko', { tab: 'news' });

        expect(meta.twitter).toBeDefined();
        expect(meta.twitter).not.toHaveProperty('images');
    });
});
