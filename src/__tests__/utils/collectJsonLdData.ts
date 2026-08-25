import { isValidElement, type ReactNode } from 'react';

/**
 * RSC 트리 안의 모든 `<JsonLd data={...} />` payload를 모은다.
 *
 * 테스트가 `JsonLd`를 `() => null`로 목킹해도 element의 props는 남으므로,
 * 렌더 없이 구조화데이터를 그대로 읽을 수 있다.
 */
export function collectJsonLdData(node: ReactNode): Record<string, unknown>[] {
    if (Array.isArray(node)) return node.flatMap(collectJsonLdData);
    if (!isValidElement(node)) return [];
    const props = node.props as {
        data?: Record<string, unknown>;
        children?: ReactNode;
    };
    const self = props.data ? [props.data] : [];
    return [...self, ...collectJsonLdData(props.children)];
}
