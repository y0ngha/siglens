/**
 * 루트 레이아웃이 클라이언트로 내려보내는 메시지 네임스페이스.
 *
 * 여기 있는 것만 **모든 라우트의 first-load에 실린다**. 헤더·푸터·전역 배너·전역
 * 모달처럼 루트에 마운트되는 클라이언트 컴포넌트가 쓰는 것만 넣는다.
 * 특정 페이지에서만 필요한 네임스페이스는 그 페이지가 `withChrome()`으로 덧붙인다.
 */
export const ROOT_CLIENT_NAMESPACES: readonly string[] = ['widgets.layout'];

/**
 * 라우트별 프로바이더에 넘길 네임스페이스 목록을 만든다.
 *
 * 중첩 `NextIntlClientProvider`는 부모의 `messages`를 **상속하지 않고 교체**하므로,
 * 페이지 프로바이더는 루트 네임스페이스를 항상 함께 포함해야 한다. 이걸 빠뜨리면
 * 그 페이지 안의 헤더/모달 문구만 키 문자열로 노출된다.
 */
export function withChrome(...namespaces: readonly string[]): string[] {
    return [...new Set([...ROOT_CLIENT_NAMESPACES, ...namespaces])];
}
