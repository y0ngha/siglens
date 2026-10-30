import type { MetadataRoute } from 'next';
import { brandAiName } from '@/shared/lib/brandName';
import {
    buildManifestBase,
    type ManifestTranslator,
} from '@/shared/lib/buildManifest';
import type { Locale } from '@/shared/i18n/locales';

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
 * 뼈대(정본 홈 `start_url`·`scope`, 색, 아이콘)는 메인과 같은 `buildManifestBase`다.
 * 오리진이 달라 두 앱은 따로 설치된다 — 홈 화면에 시그렌즈와 시그렌즈 AI가 각각 생긴다.
 * 메인과 달리 바로가기·스크린샷은 없다(대화 앱은 홈 하나가 입구다). ko는 접두사 없이
 * `/c/*`·`/about`이고 그 외 로케일의 대화(`/en/c/*`)는 로케일 홈 아래라 설치 앱 안에서 열린다.
 */
export function buildAiManifest(
    locale: Locale,
    t: ManifestTranslator
): MetadataRoute.Manifest {
    return buildManifestBase(locale, {
        name: t('name', { v0: brandAiName(locale) }),
        shortName: brandAiName(locale),
        description: t('description'),
    });
}
