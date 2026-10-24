import { getTranslations } from 'next-intl/server';
import { beforeAll } from 'vitest';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';
import { buildSymbolSeoContent, type SeoTranslator } from '@/shared/lib/seo';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';

let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

describe('symbolMetadataFromSeo', () => {
    // `describe` 콜백 본문은 vitest의 수집(collection) 단계에서 즉시 실행되므로,
    // `beforeAll`이 채우기 전의 `t`를 참조하면 `undefined`다. `beforeAll` 안에서
    // 계산해야 실행(run) 단계 — 바깥 `beforeAll`이 `t`를 채운 뒤 — 에 돈다.
    let baseSeo: ReturnType<typeof buildSymbolSeoContent>;
    beforeAll(() => {
        baseSeo = buildSymbolSeoContent('AAPL', t, {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
    });

    it('title/description/keywords를 그대로 매핑한다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');

        // title은 { absolute } 형태다 — 루트 레이아웃의 title.template
        // ("%s | SIGLENS" 자동 접미사)를 무시하기 위함(Task 6).
        expect(meta.title).toEqual({ absolute: baseSeo.title });
        expect(meta.description).toBe(baseSeo.description);
        expect(meta.keywords).toEqual(baseSeo.keywords);
    });

    /**
     * 회귀 방지: `/en/AAPL`의 `<title>`이 한국어 사이트 기본 제목으로 떨어졌던 건.
     * 색인은 막되 **제목·설명·og는 그 로케일 것**이 나가야 한다.
     */
    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 색인은 막지만 제목은 유지하고 follow는 남긴다',
        locale => {
            const meta = symbolMetadataFromSeo(baseSeo, locale);

            expect(meta.robots).toEqual({ index: false, follow: true });
            expect(meta.title).toEqual({ absolute: baseSeo.title });
            expect(meta.description).toBe(baseSeo.description);
            expect((meta.openGraph as Record<string, unknown>)['title']).toBe(
                baseSeo.fullTitle
            );
        }
    );

    it('기본 로케일에는 robots를 덮지 않는다', () => {
        expect(symbolMetadataFromSeo(baseSeo, 'ko').robots).toBeUndefined();
    });

    it('alternates.canonical이 seo.url이다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');

        expect(meta.alternates?.canonical).toBe(baseSeo.url);
    });

    it('en의 og:site_name은 SIGLENS다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'en');
        const og = meta.openGraph as Record<string, unknown>;

        expect(og['siteName']).toBe(SITE_NAME);
    });

    it('openGraph에 type/siteName/locale이 고정값으로 들어간다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const og = meta.openGraph as Record<string, unknown>;

        expect(og['type']).toBe('website');
        expect(og['siteName']).toBe(SITE_NAME_KO);
        expect(og['locale']).toBe('ko_KR');
        expect(og['title']).toBe(baseSeo.fullTitle);
        expect(og['description']).toBe(baseSeo.description);
        expect(og['url']).toBe(baseSeo.url);
    });

    it('twitter에 card/title/description이 들어간다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const tw = meta.twitter as Record<string, unknown>;

        expect(tw['card']).toBe('summary_large_image');
        // twitter.title은 fullTitle(브랜드 포함) — 소셜 카드는 SERP 폭
        // 제약이 없고 브랜드 노출이 도움이 된다(Task 6).
        expect(tw['title']).toBe(baseSeo.fullTitle);
        expect(tw['title']).toContain(SITE_NAME_KO);
        expect(tw['description']).toBe(baseSeo.description);
    });

    it('openGraph.title이 fullTitle(브랜드 포함)이고 meta.title이 absolute(브랜드 제외)이다', () => {
        const meta = symbolMetadataFromSeo(baseSeo, 'ko');
        const og = meta.openGraph as Record<string, unknown>;

        // title은 { absolute }로 루트 레이아웃의 "| SIGLENS" 자동 접미사를
        // 무시한다 → 브랜드 미포함(Task 6, `| SIGLENS` 8 폭단위를 검색 의도
        // 카피로 되돌린다).
        // as 캐스팅 근거: symbolMetadataFromSeo는 항상 title을 { absolute }
        // 형태로만 반환한다(구현 참고) — Next.js Metadata['title'] 유니온
        // (string | TemplateString | null)을 좁히는 것이지 검증 안 된 값을
        // 단언하는 게 아니다.
        const titleMeta = meta.title as { absolute: string };
        expect(titleMeta.absolute).toBe(baseSeo.title);
        expect(titleMeta.absolute).not.toContain(SITE_NAME_KO);
        // openGraph/twitter title은 fullTitle(브랜드 포함) 사용 —
        // 소셜 카드는 SERP 폭 제약이 없고 브랜드 노출이 도움이 된다.
        expect(og['title']).toContain(SITE_NAME_KO);
    });
});
