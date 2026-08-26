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

/**
 * 같은 타입의 요소를 **전부** 모은다. `findElementByType`은 첫 일치에서 멈추므로
 * "한 번만 렌더됐는가"를 물을 수 없다 — 중복이야말로 확인해야 할 결함일 때가 있다.
 */
export function findAllElementsByType(
    node: ReactNode,
    type: unknown
): ReactElement[] {
    if (Array.isArray(node)) {
        return node.flatMap(child => findAllElementsByType(child, type));
    }
    if (!isValidElement(node)) return [];
    const childProps = node.props as { children?: ReactNode };
    const nested = findAllElementsByType(childProps.children, type);
    return node.type === type ? [node, ...nested] : nested;
}
