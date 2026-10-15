import { SaxesParser } from 'saxes';

/**
 * 스트리밍 XML 파서가 만들어 내는 요소 하나.
 *
 * `name`은 네임스페이스 접두사를 뗀 로컬 이름이다(`ns1:infoTable` → `infoTable`) — SEC 제출
 * 문서는 같은 스키마인데도 제출 도구마다 접두사가 다르다. 속성은 읽지 않는다.
 */
export interface XmlElement {
    readonly name: string;
    /** 이 요소에 직접 달린 텍스트(자식 요소 텍스트 제외)를 이어 붙여 trim한 값. */
    text: string;
    readonly children: XmlElement[];
}

export type XmlChunkSource =
    | AsyncIterable<string | Uint8Array>
    | Iterable<string | Uint8Array>;

/** 문서에 담긴 요소 수·깊이를 제한해 악의적·손상 입력이 메모리를 키우지 못하게 한다. */
const MAX_ELEMENT_DEPTH = 32;

function localName(qualified: string): string {
    const colon = qualified.indexOf(':');
    return colon === -1 ? qualified : qualified.slice(colon + 1);
}

/**
 * `source`의 청크를 순서대로 SAX 파싱하며, 로컬 이름이 `elementName`인 요소가 **닫힐 때마다**
 * 완성된 부분 트리를 `onElement`로 넘긴다. 넘긴 요소는 즉시 버리므로 문서 전체가 메모리에 올라오지
 * 않는다 — 수십만 행짜리 13F information table도 행 하나 분량만 든다.
 *
 * - 대상 요소 바깥의 텍스트·요소는 무시한다.
 * - 대상 요소 안에 같은 이름이 중첩되면 바깥 것의 자손으로 처리한다(콜백은 가장 바깥 요소에서 한 번).
 * - 잘못된 XML이면 `saxes`가 던진 오류를 그대로 전파한다 — 호출부는 문서 단위 실패로 다룬다.
 * - `onElement`가 던지면 파싱을 멈추고 전파한다.
 */
export async function streamXmlElements(
    source: XmlChunkSource,
    elementName: string,
    onElement: (element: XmlElement) => void
): Promise<void> {
    const parser = new SaxesParser({ xmlns: false });
    const decoder = new TextDecoder('utf-8');
    const stack: XmlElement[] = [];

    parser.on('opentag', tag => {
        const name = localName(tag.name);
        if (stack.length === 0 && name !== elementName) return;
        if (stack.length >= MAX_ELEMENT_DEPTH) {
            throw new Error('XML nesting too deep');
        }
        const element: XmlElement = { name, text: '', children: [] };
        stack.at(-1)?.children.push(element);
        stack.push(element);
    });
    const appendText = (text: string): void => {
        const current = stack.at(-1);
        if (current !== undefined) current.text += text;
    };
    parser.on('text', appendText);
    parser.on('cdata', appendText);
    parser.on('closetag', () => {
        const element = stack.pop();
        if (element === undefined) return;
        element.text = element.text.trim();
        if (stack.length === 0) onElement(element);
    });

    for await (const chunk of source) {
        parser.write(
            typeof chunk === 'string'
                ? chunk
                : decoder.decode(chunk, { stream: true })
        );
    }
    parser.write(decoder.decode());
    parser.close();
}

/** `path`를 따라 내려간 첫 요소의 텍스트. 없거나 빈 문자열이면 `null`. */
export function xmlChildText(
    element: XmlElement,
    ...path: readonly string[]
): string | null {
    let current: XmlElement | undefined = element;
    for (const name of path) {
        current = current.children.find(child => child.name === name);
        if (current === undefined) return null;
    }
    return current.text === '' ? null : current.text;
}
