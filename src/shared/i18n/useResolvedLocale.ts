import { useLocale } from 'next-intl';
import { isLocale, DEFAULT_LOCALE, type Locale } from './locales';

/**
 * 현재 로케일 — **서버 컴포넌트와 클라이언트 컴포넌트 양쪽**에서 쓴다.
 *
 * `useCurrentLocale()`(`LocaleContext`)은 `'use client'` 모듈이라 서버
 * 컴포넌트에서 부르면 렌더가 통째로 죽는다:
 *
 *   ⨯ Attempted to call useCurrentLocale() from the server but
 *     useCurrentLocale is on the client.
 *
 * 실제로 그렇게 냈다 — 날짜 포맷을 로케일화하면서 `SnapshotSummarySection`에
 * 클라이언트 훅을 넣었고, **종목 페이지 본문 전체가 전 로케일에서 SSR되지
 * 않았다**(ko 포함). 타입체크·린트·10,697개 테스트·프로덕션 빌드가 전부
 * 통과했다 — 서버 렌더 경계는 그중 무엇도 보지 않는다.
 *
 * next-intl의 `useLocale`은 RSC 진입점(`index.react-server`)과 클라이언트
 * 진입점 양쪽에 있어 경계와 무관하게 동작한다. 반환값이 카탈로그에 없는
 * 문자열일 수 있으므로(설정 오류·미들웨어 우회) 여기서 좁힌다.
 */
export function useResolvedLocale(): Locale {
    const locale = useLocale();
    return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
