import type { MetadataRoute } from 'next';
import { brandAiName } from '@/shared/lib/brandName';
import {
    LOCALE_HREFLANG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';

/** `app.ai.manifest` 번역자. */
type AiManifestTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/**
 * ai 호스트 문서가 `<link rel="manifest">`로 가리키는 경로.
 *
 * 메인 호스트의 `/{locale}/manifest.webmanifest`와 겹치지 않게 내부 라우트 모양
 * (`/ai/{locale}/…`) 그대로 둔다. `.webmanifest`는 `proxy.ts` matcher 밖이라 ai 호스트의
 * `/ai/*` rewrite도, 메인 호스트의 `/ai/*` → ai 호스트 308도 타지 않고 이 라우트에 바로
 * 닿는다. ko도 접두사를 붙인다 — 기본 로케일 정규화(접두사 제거)는 페이지 URL 규칙이고
 * 이 경로는 페이지가 아니다.
 */
export function aiManifestPath(locale: Locale): string {
    return `/ai/${locale}/manifest.webmanifest`;
}

/**
 * SIGLENS AI(ai.siglens.io) 웹 앱 매니페스트.
 *
 * 매니페스트의 상대 URL은 **매니페스트를 받은 오리진** 기준이라 `start_url`·`scope`의
 * `/`는 ai 호스트의 홈이다. 메인 사이트(`buildManifest`)와 오리진이 달라 두 앱은 따로
 * 설치된다 — 홈 화면에 시그렌즈와 시그렌즈 AI가 각각 생긴다.
 *
 * `start_url`·`scope`는 로케일 홈의 **정본 URL**이다 — ko `/`, 그 외 `/en`(끝 슬래시 없음).
 * Next 기본값(`trailingSlash: false`)이 `/en/`을 `/en`으로 308 보내므로, `/en/`을 쓰면 앱이
 * 열리자마자 스코프 밖 URL에 떨어져 standalone 창에 브라우저 툴바가 뜬다. 끝 슬래시 없는
 * `/en` 스코프는 `/enigma` 같은 형제 경로도 받지만 ai 호스트에는 그런 경로가 없다(ko는 접두사
 * 없이 `/c/*`·`/about`이다). 대화(`/en/c/*`)는 그 아래라 설치 앱 안에서 열린다.
 */
export function buildAiManifest(
    locale: Locale,
    t: AiManifestTranslator
): MetadataRoute.Manifest {
    const home = localePath(locale, '/');
    return {
        id: home,
        name: t('name', { v0: brandAiName(locale) }),
        short_name: brandAiName(locale),
        description: t('description'),
        lang: LOCALE_HREFLANG[locale],
        dir: 'ltr',
        start_url: home,
        scope: home,
        display: 'standalone',
        display_override: ['standalone'],
        /* 메인 매니페스트와 같은 이유로 다크 기본 테마(secondary-900)에 고정한다. */
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
            { src: '/icon192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon512.png', sizes: '512x512', type: 'image/png' },
        ],
    };
}
