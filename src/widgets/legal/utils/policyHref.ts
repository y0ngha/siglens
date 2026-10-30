/**
 * 약관·개인정보처리방침 마크다운 본문의 링크 href를 분류하는 순수 헬퍼.
 *
 * 본문은 DB에 든 마크다운이라 내부 경로(`/privacy`), 메일(`mailto:`), 외부 URL이
 * 섞여 온다. 어느 링크 컴포넌트로 그리고 새 탭으로 열지를 여기서만 정한다.
 */

/**
 * 새 탭으로 열면 안 되는 href 접두사.
 *
 * `mailto:`·`tel:`은 브라우저가 외부 앱으로 넘기므로 `target="_blank"`면 빈 탭만
 * 남고, `#…`는 같은 문서 안 이동이라 새 탭이면 문서 사본이 하나 더 열린다.
 */
const SAME_TAB_PREFIXES: readonly string[] = ['mailto:', 'tel:', '#'];

/**
 * 사이트 내부 경로인지 — `/`로 시작하되 프로토콜 상대 URL(`//cdn…`)은 아니다.
 * 참이면 로케일 접두사를 붙이는 `LocaleLink`로 그린다.
 */
export function isInternalHref(href: string | undefined): href is string {
    if (!href) return false;
    return href.startsWith('/') && !href.startsWith('//');
}

/**
 * 내부 경로가 아닌 링크를 새 탭으로 열지. 메일·전화·문서 내 앵커는 같은 탭,
 * 그 밖의 외부 URL(빈 href 포함)은 새 탭이다.
 */
export function opensInNewTab(href: string | undefined): boolean {
    if (!href) return true;
    const normalized = href.toLowerCase();
    return !SAME_TAB_PREFIXES.some(prefix => normalized.startsWith(prefix));
}
