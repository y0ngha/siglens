import type { MetadataRoute } from 'next';
import { brandName } from '@/shared/lib/brandName';
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

/** 매니페스트마다 다른 이름·설명. */
export interface ManifestIdentity {
    readonly name: string;
    readonly shortName: string;
    readonly description: string;
}

/**
 * 로케일 홈의 **정본 URL** — ko `/`, 그 외 `/en`(끝 슬래시 없음).
 *
 * `start_url`·`scope`·`id`가 이 값이어야 한다. Next 기본값(`trailingSlash: false`)이
 * `/en/`을 `/en`으로 308 보내므로(로컬 실측), 예전처럼 `/en/`을 쓰면 설치 앱이 열리자마자
 * 스코프(`/en/`) 밖 URL에 떨어져 standalone 창에 브라우저 툴바가 떴다.
 *
 * 감수한 대가: 끝 슬래시 없는 `/en` 스코프는 `/en`으로 시작하는 ko 경로도 받는다 — 종목 라우트가
 * 대소문자를 가리지 않아 `/enph`·`/jazz` 같은 ko 종목 페이지가 en·ja 설치 앱 **창 안에서** 열린다.
 * 앱 홈이 늘 스코프 밖인 것보다 작은 문제라 받아들였다. 막으려면 `/en/`이 리다이렉트되지 않는
 * 홈이어야 하므로 매니페스트가 아니라 라우팅 변경이다.
 */
export function manifestHome(locale: Locale): string {
    return localePath(locale, '/');
}

/**
 * 매니페스트 `id` — 설치된 앱의 **정체성**이다. `start_url`과 달리 바꾸면 브라우저가 다른 앱으로
 * 본다(기존 설치본은 매니페스트 갱신을 못 받고, 설치 배너가 다시 떠 아이콘이 둘 생긴다).
 * 그래서 `start_url`을 정본 홈으로 고칠 때도 `id`는 예전 값(로케일 홈 + 끝 슬래시, ko `/`)을
 * 유지한다. `id`는 식별자일 뿐 실제로 열리는 URL일 필요가 없다.
 */
export function manifestId(locale: Locale): string {
    return `${localePath(locale, '/')}/`.replace(/\/{2,}$/, '/');
}

/**
 * 메인 사이트·SIGLENS AI 두 매니페스트가 공유하는 뼈대.
 *
 * 매니페스트의 상대 URL은 **매니페스트를 받은 오리진** 기준이라 같은 `/`라도 siglens.io와
 * ai.siglens.io의 홈을 각각 가리키고, 두 앱은 따로 설치된다.
 */
export function buildManifestBase(
    locale: Locale,
    { name, shortName, description }: ManifestIdentity
): MetadataRoute.Manifest {
    const home = manifestHome(locale);
    return {
        id: manifestId(locale),
        name,
        short_name: shortName,
        description,
        lang: LOCALE_HREFLANG[locale],
        dir: 'ltr',
        start_url: home,
        scope: home,
        display: 'standalone',
        display_override: ['standalone'],
        /* PWA manifest는 미디어 쿼리 형식을 지원하지 않아 단일 값만 가능하다.
           기본 테마인 다크(secondary-900)에 고정한다. */
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
            { src: '/icon192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon512.png', sizes: '512x512', type: 'image/png' },
        ],
    };
}

/**
 * 웹 앱 매니페스트를 로케일별로 만든다.
 *
 * 매니페스트는 오리진당 하나가 아니라 **문서마다 `<link rel="manifest">`로
 * 가리키는 대상**이다. 그래서 로케일 레이아웃이 `/{locale}/manifest.webmanifest`를
 * 가리키면 설치 프롬프트(이름·설명·바로가기)까지 그 로케일로 나온다. 예전에는
 * 한국어 상수 하나뿐이라 `/en`에서 설치해도 홈 화면 이름이 한국어였다.
 *
 * `start_url`·`scope`·`shortcuts` 경로도 로케일 접두사를 붙인다 — 안 붙이면
 * 설치된 앱이 항상 한국어 홈에서 시작한다(`manifestHome`·`manifestId`).
 */
export function buildManifest(
    locale: Locale,
    t: ManifestTranslator
): MetadataRoute.Manifest {
    const base = buildManifestBase(locale, {
        name: t('name', { v0: brandName(locale) }),
        shortName: brandName(locale),
        description: t('description'),
    });
    const shortcutIcons = [
        { src: '/icon96.png', sizes: '96x96', type: 'image/png' },
    ];
    return {
        ...base,
        orientation: 'portrait',
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
                url: `${base.start_url}?focus=search`,
                icons: shortcutIcons,
            },
        ],
    };
}
