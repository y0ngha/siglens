import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/shared/lib/seo';
import {
    LOCALE_HREFLANG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';

/** `shared.seo.manifest` 번역자. */
type ManifestTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/**
 * 웹 앱 매니페스트를 로케일별로 만든다.
 *
 * 매니페스트는 오리진당 하나가 아니라 **문서마다 `<link rel="manifest">`로
 * 가리키는 대상**이다. 그래서 로케일 레이아웃이 `/{locale}/manifest.webmanifest`를
 * 가리키면 설치 프롬프트(이름·설명·바로가기)까지 그 로케일로 나온다. 예전에는
 * 한국어 상수 하나뿐이라 `/en`에서 설치해도 홈 화면 이름이 한국어였다.
 *
 * `start_url`·`scope`·`shortcuts` 경로도 로케일 접두사를 붙인다 — 안 붙이면
 * 설치된 앱이 항상 한국어 홈에서 시작한다.
 */
export function buildManifest(
    locale: Locale,
    t: ManifestTranslator
): MetadataRoute.Manifest {
    // `localePath(locale, '/')`는 비-ko에서 `/en`(끝 슬래시 없음)을 준다.
    // `start_url`/`scope`는 디렉터리라 끝 슬래시가 있어야 `/enigma` 같은 형제
    // 경로가 스코프에 딸려 들어가지 않는다.
    const home = `${localePath(locale, '/')}/`.replace(/\/{2,}$/, '/');
    const shortcutIcons = [
        { src: '/icon96.png', sizes: '96x96', type: 'image/png' },
    ];
    return {
        id: home,
        name: t('name', { v0: SITE_NAME }),
        short_name: SITE_NAME,
        description: t('description'),
        lang: LOCALE_HREFLANG[locale],
        dir: 'ltr',
        start_url: home,
        scope: home,
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'portrait',
        /* PWA manifest는 미디어 쿼리 형식을 지원하지 않아 단일 값만 가능하다.
           기본 테마인 다크(secondary-900)에 고정한다. */
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
            { src: '/icon192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon512.png', sizes: '512x512', type: 'image/png' },
        ],
        screenshots: [
            {
                src: '/og-image.png',
                sizes: '1200x630',
                type: 'image/png',
                form_factor: 'wide',
            },
        ],
        shortcuts: [
            {
                name: t('shortcutMarket'),
                url: localePath(locale, '/market'),
                icons: shortcutIcons,
            },
            {
                name: t('shortcutSearch'),
                url: `${home}?focus=search`,
                icons: shortcutIcons,
            },
        ],
    };
}
