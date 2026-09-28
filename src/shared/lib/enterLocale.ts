import { setRequestLocale } from 'next-intl/server';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';

/**
 * `[locale]` 서버 페이지·레이아웃의 진입 처리 — 요청 로케일을 등록하고, 검증된
 * `Locale`을 돌려준다.
 *
 * **`setRequestLocale`은 정적 렌더를 켜는 스위치다.** 이 호출이 없으면 next-intl의
 * 서버 API(`getTranslations` 등)가 `headers()`로 폴백해 **그 라우트의 ISR이 통째로
 * 꺼진다**(빌드 route 표에서 `●` → `ƒ`). 실측으로 확인했다 — Next 16.2는
 * `next/root-params`를 지원하지 않아 이 경로가 유일하다. 그래서 번역을 읽기
 * **전에** 불러야 한다.
 *
 * 등록은 URL 세그먼트 원본으로 한다(기존 호출부와 같은 값). 반환값만 신뢰 경계
 * 검증(`resolveLocale`)을 거친다 — 알 수 없는 세그먼트는 `[locale]/layout.tsx`가
 * 이미 404로 돌려보내므로 실사용 경로에선 둘이 같다.
 */
export function enterLocale(rawLocale: string): Locale {
    setRequestLocale(rawLocale);
    return resolveLocale(rawLocale);
}
