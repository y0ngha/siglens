import type { Viewport } from 'next';

/**
 * 모바일 뷰포트 판정 미디어 쿼리. Tailwind `md`(768px) 미만을 모바일로 본다 —
 * 모바일 전용 UI에 붙는 `md:hidden`과 같은 경계여야 CSS와 JS 판정이 어긋나지 않는다.
 *
 * 훅(`useIsMobileViewport`)이 아니라 config에 두는 이유: 훅을 `vi.mock`하는 테스트가
 * 있어, 훅 모듈에서 이 상수를 함께 export하면 그 mock들이 전부 상수까지 되돌려줘야
 * 한다(실제로 그렇게 두었다가 기존 테스트 61건이 깨졌다). 값 자체는 렌더 로직이
 * 아니므로 config가 제자리다.
 */
export const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Tailwind `lg`(1024px) 미만. 데스크톱 레일을 `lg:block`으로, 모바일 바·서랍을
 * `lg:hidden`으로 가르는 화면(ai 채팅 셸)과 그 크롬을 숨기는 훅이 같은 경계를 써야
 * CSS와 JS 판정이 어긋나지 않는다. `MOBILE_VIEWPORT_MEDIA_QUERY`(md)와는 다른 경계다.
 */
export const BELOW_LG_MEDIA_QUERY = '(max-width: 1023.98px)';

/**
 * 두 호스트(siglens.io·ai.siglens.io)의 루트 레이아웃이 함께 쓰는 `viewport`.
 * ai 호스트는 별도 루트 레이아웃이라 메인의 값을 상속하지 않는다 — 한곳에서 내보내야
 * 주소창 띠 색과 노치 처리가 두 호스트에서 어긋나지 않는다.
 *
 * - `themeColor`: 리디자인 다크(secondary-900). 예전 값(#0f172a)은 헤더와 달라
 *   iOS 주소창 띠만 다른 색으로 떠 있었다(manifest와 같은 근거). 라이트 테마 전환 시에는
 *   `useTheme`이 런타임에 meta를 갈아 끼운다.
 * - `viewportFit: 'cover'`: 노치 영역까지 칠하고 안전 영역은 CSS env()로 비운다.
 */
export const SITE_VIEWPORT: Viewport = {
    themeColor: '#09090b',
    viewportFit: 'cover',
};
