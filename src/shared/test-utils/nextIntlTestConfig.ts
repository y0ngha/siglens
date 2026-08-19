import koMessages from '../../../messages/ko.json';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

/**
 * Vitest용 `next-intl/config` 대체 모듈.
 *
 * `next-intl/config`는 빌드 플러그인이 만들어 주는 가상 모듈이라 vitest에는 없다.
 * 없으면 서버 컴포넌트의 `useTranslations`/`getTranslations`가
 * "Couldn't find next-intl config file"로 던져 페이지 테스트가 통째로 깨진다.
 *
 * 프로덕션 설정(`src/shared/i18n/request.ts`)을 그대로 쓸 수는 없다 — 그쪽은
 * `requestLocale`을 통해 `headers()`를 읽는데 vitest에는 요청이 없다.
 * 대신 **실제 ko 카탈로그**를 기본 로케일로 고정해 돌려준다. 그러면 한국어
 * 문자열을 단언하는 기존 테스트가 그대로 통과하고, 카탈로그에서 키가 빠지면
 * 폴백 문자열이 나와 테스트가 진짜로 실패한다.
 *
 * 로케일별 동작은 `renderWithIntl(ui, { locale })`이나 명시적 mock으로 검증한다.
 */
export default function getTestRequestConfig() {
    return {
        locale: DEFAULT_LOCALE,
        messages: koMessages,
        timeZone: 'Asia/Seoul',
    };
}
