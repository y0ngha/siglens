import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';

/**
 * 첫 페인트 **전에** `<html data-theme>`을 찍는 렌더 블로킹 스크립트.
 *
 * 이 프로젝트에서 렌더 블로킹이 **의도된** 유일한 스크립트다. 모든 라우트가
 * ISR 정적이라 서버는 사용자의 테마를 모르고, 쿠키로 넘기면 공유 셸이
 * dynamic이 되어 전 라우트 ISR이 깨진다(축 0 규약). 속성을 미리 찍지 않으면
 * 다크 셸이 칠해진 뒤 라이트로 바뀌는 깜빡임이 난다. 스크립트 본문과 판정
 * 근거는 `shared/lib/theme.ts` 참조.
 *
 * **한 컴포넌트로 모은 이유**: 루트 레이아웃과 `global-error`가 각자 같은
 * 주입 코드를 들고 있었다. `global-error`는 루트 레이아웃을 **교체**하므로
 * 거기 있던 부트스트랩도 같이 사라지고, 없으면 라이트를 고른 사용자가 완전히
 * 어두운 에러 화면을 본다(토큰 기본값이 다크). 즉 두 벌이 필요한 게 아니라
 * 두 셸이 같은 한 벌을 써야 하는 자리다 — 복사본은 한쪽만 고쳐질 뿐이다.
 */
export function ThemeInitScript() {
    return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
