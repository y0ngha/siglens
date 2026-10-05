import { cloneElement, isValidElement, type ReactNode } from 'react';

/**
 * 엘리먼트 트리 안의 **async 서버 컴포넌트**를 재귀로 실행해 일반 엘리먼트 트리로 만든다.
 *
 * 클라이언트 `render()`(RTL)는 async 컴포넌트를 돌리지 못한다. 서버 데이터 섹션을 Suspense로
 * 감싸지 않게 된 뒤(2026-10-05)에는 페이지 함수의 반환 트리에 async 컴포넌트가 그대로 들어
 * 있으므로, 전체 페이지를 렌더하는 테스트는 이 헬퍼로 먼저 풀어 준다.
 *
 * 함수 컴포넌트의 훅은 이 호출 경로에서 쓸 수 없다 — async 컴포넌트(`getTranslations` 계열)만
 * 풀고, 동기 함수 컴포넌트는 그대로 두어 RTL이 렌더하게 한다.
 */
export async function resolveAsyncServerTree(
    node: ReactNode
): Promise<ReactNode> {
    if (Array.isArray(node)) {
        return Promise.all(node.map(child => resolveAsyncServerTree(child)));
    }
    if (!isValidElement(node)) return node;
    const type = node.type;
    if (
        typeof type === 'function' &&
        type.constructor.name === 'AsyncFunction'
    ) {
        const resolved = await (type as (props: unknown) => Promise<ReactNode>)(
            node.props
        );
        return resolveAsyncServerTree(resolved);
    }
    const children = (node.props as { children?: ReactNode }).children;
    if (children === undefined) return node;
    return cloneElement(node, {}, await resolveAsyncServerTree(children));
}
