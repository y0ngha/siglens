import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/lib/seo';

/**
 * 문장 속 브랜드 표기. ko는 한글 표기, 다른 로케일은 영문 표기.
 *
 * `seo.ts`가 아니라 여기 두는 이유: 클라이언트 컴포넌트(404 문구·공유 오류)도
 * 부른다. `seo.ts`는 번역자를 인자로 받는 서버 전용 헬퍼 모음이라, 그 파일의
 * 함수를 클라이언트가 부르기 시작하면 `noTranslatorParamCall` 가드의 서버 전용
 * 면제가 깨진다. 상수 import는 그 가드 대상이 아니다.
 */
export function brandName(locale: Locale): string {
    return locale === DEFAULT_LOCALE ? SITE_NAME_KO : SITE_NAME;
}
