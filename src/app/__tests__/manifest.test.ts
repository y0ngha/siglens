vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

import manifest from '@/app/manifest';
import { buildManifest } from '@/shared/lib/buildManifest';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { LOCALE_HREFLANG, LOCALES } from '@/shared/i18n/locales';

const NS = 'shared.seo.manifest';

describe('manifest (기본 로케일)', () => {
    it('returns a valid manifest object', async () => {
        const result = await manifest();

        expect(result).toBeDefined();
        expect(result.name).toContain('Siglens');
        expect(result.short_name).toBe('Siglens');
    });

    it('sets display to standalone', async () => {
        expect((await manifest()).display).toBe('standalone');
    });

    it('includes PWA icons', async () => {
        expect((await manifest()).icons).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sizes: '192x192' }),
                expect.objectContaining({ sizes: '512x512' }),
            ])
        );
    });

    it('includes shortcuts for market and search', async () => {
        const result = await manifest();

        expect(result.shortcuts).toHaveLength(2);
        expect(result.shortcuts![0].url).toBe('/market');
        expect(result.shortcuts![1].url).toBe('/?focus=search');
    });

    it('sets lang to the ko hreflang', async () => {
        expect((await manifest()).lang).toBe(LOCALE_HREFLANG.ko);
    });

    it('sets start_url to /', async () => {
        expect((await manifest()).start_url).toBe('/');
    });
});

/**
 * 매니페스트는 문서마다 `<link rel="manifest">`로 가리키는 대상이라 로케일별로
 * 낼 수 있다 — 하나로 두면 `/en`에서 설치해도 홈 화면 이름이 한국어로 굳는다.
 * 여기서는 (1) 비-ko 판에 한글이 남지 않는지 (2) 진입 경로가 그 로케일을
 * 유지하는지를 본다. 후자를 빠뜨리면 설치된 앱이 늘 한국어 홈에서 시작한다.
 */
describe('buildManifest — 로케일별', () => {
    it.each(LOCALES)('%s: 진입 경로가 로케일을 유지한다', locale => {
        const result = buildManifest(locale, catalogTranslator(NS, locale));
        const prefix = locale === 'ko' ? '' : `/${locale}`;

        expect(result.start_url).toBe(`${prefix}/`);
        expect(result.scope).toBe(`${prefix}/`);
        expect(result.shortcuts![0].url).toBe(`${prefix}/market`);
        expect(result.shortcuts![1].url).toBe(`${prefix}/?focus=search`);
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 이름·설명·바로가기에 한글이 남지 않는다',
        locale => {
            const result = buildManifest(locale, catalogTranslator(NS, locale));

            for (const value of [
                result.name,
                result.description,
                ...result.shortcuts!.map(s => s.name),
            ]) {
                expect(value, `${locale}: ${value}`).not.toMatch(/[가-힣]/);
            }
        }
    );

    it.each(LOCALES)('%s: lang이 hreflang을 따른다', locale => {
        expect(buildManifest(locale, catalogTranslator(NS, locale)).lang).toBe(
            LOCALE_HREFLANG[locale]
        );
    });
});
