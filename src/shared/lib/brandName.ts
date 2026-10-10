import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';

/**
 * 문장 속 브랜드 표기. ko는 한글 표기, 다른 로케일은 영문 표기.
 *
 * `seo.ts`가 아니라 여기 두는 이유: 클라이언트 컴포넌트(404 문구·공유 오류)도
 * 부른다. `seo.ts`는 번역자를 인자로 받는 서버 전용 헬퍼 모음이라, 그 파일의
 * 함수를 클라이언트가 부르기 시작하면 `noTranslatorParamCall` 가드의 서버 전용
 * 면제가 깨진다. 상수 import는 그 가드 대상이 아니다.
 *
 * 로고·워드마크(헤더 로고, OG 이미지)와 JSON-LD `name`은 이 함수를 쓰지 않고
 * `SITE_NAME`을 그대로 쓴다 — 표기 규칙(`CONVENTIONS.md#I18-11`)의 예외다.
 */
export function brandName(locale: Locale): string {
    return locale === DEFAULT_LOCALE ? SITE_NAME_KO : SITE_NAME;
}

/** AI 제품 표기 — ko `시그렌즈 AI`, 다른 로케일 `SIGLENS AI`. */
export function brandAiName(locale: Locale): string {
    return `${brandName(locale)} AI`;
}

/**
 * 브랜드 접미사를 붙인 문서 제목(`… | 시그렌즈` / `… | SIGLENS`).
 *
 * 루트 레이아웃의 `title.template`과 `absolute` 제목·OG/Twitter 제목을 직접 조립하는
 * 곳이 모두 이 함수를 써야 한 페이지의 `<title>`과 `og:title` 접미사가 갈리지 않는다.
 */
export function brandTitle(title: string, locale: Locale): string {
    return `${title} | ${brandName(locale)}`;
}
