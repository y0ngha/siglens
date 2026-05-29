import { isValidElement, type ReactElement, type ReactNode } from 'react';

/**
 * 렌더 없이 RSC가 반환한 element 트리를 재귀 순회해 주어진 컴포넌트 타입의
 * 첫 element를 찾는다. async 서버 컴포넌트(page.tsx 등)는 @testing-library/react로
 * 직접 렌더할 수 없으므로(Promise<JSX.Element> 반환), props 주입 검증은 트리
 * 탐색으로 수행한다.
 */
export function findElementByType(
    node: ReactNode,
    type: unknown
): ReactElement | null {
    if (Array.isArray(node)) {
        return node.reduce<ReactElement | null>(
            (found, child) => found ?? findElementByType(child, type),
            null
        );
    }
    if (!isValidElement(node)) return null;
    if (node.type === type) return node;
    const childProps = node.props as { children?: ReactNode };
    return findElementByType(childProps.children, type);
}
