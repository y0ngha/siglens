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
