/**
 * 루트 레이아웃이 클라이언트로 내려보내는 메시지 네임스페이스.
 *
 * 여기 있는 것만 **모든 라우트의 first-load에 실린다**. 헤더·푸터·전역 배너·전역
 * 모달처럼 루트에 마운트되는 클라이언트 컴포넌트가 쓰는 것만 넣는다.
 * 특정 페이지에서만 필요한 네임스페이스는 그 페이지가 `withChrome()`으로 덧붙인다.
 */
import generated from '../../../messages/_meta/clientNamespaces.json';

/**
 * ⚠️ 이 목록은 `yarn i18n:extract`가 생성한다(`messages/_meta/clientNamespaces.json`).
 * 손으로 고치지 말 것 — 새 클라이언트 컴포넌트가 추가될 때마다 빠뜨리게 되고,
 * 그 누락은 빌드가 아니라 런타임 `MISSING_MESSAGE`로만 드러난다.
 *
 * **트레이드오프**: 클라이언트 네임스페이스 전체가 모든 라우트의 first-load에 실린다.
 * 라우트별로 좁히려면 각 페이지가 `withChrome(...)`로 자체 프로바이더를 만들어야
 * 하는데, 지금은 어느 페이지가 어느 클라이언트 네임스페이스를 쓰는지 정적으로
 * 알 수 없다(컴포넌트 조합이 런타임에 결정된다). 페이로드가 문제로 관측되면
 * 그때 라우트별 매핑을 생성하는 쪽으로 좁힌다.
 */
export const ROOT_CLIENT_NAMESPACES: readonly string[] = generated;

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
