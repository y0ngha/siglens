/**
 * 포커스를 쥔 요소가 DOM에서 빠져 브라우저가 포커스를 `<body>`로 되돌렸는지. 행이 버튼을 갈아
 * 끼운 뒤 포커스를 되돌려도 되는지(다른 컨트롤이 이미 받지 않았는지) 판단하는 데 쓴다.
 */
export function isFocusLost(doc: Document = document): boolean {
    return doc.activeElement === null || doc.activeElement === doc.body;
}
