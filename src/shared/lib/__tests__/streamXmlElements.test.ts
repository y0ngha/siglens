import { describe, expect, it } from 'vitest';
import {
    streamXmlElements,
    xmlChildText,
    type XmlElement,
} from '@/shared/lib/streamXmlElements';

async function* asChunks(
    text: string,
    size: number
): AsyncGenerator<Uint8Array> {
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i += size) {
        yield bytes.slice(i, i + size);
    }
}

async function collect(
    source: AsyncIterable<Uint8Array> | string[],
    name: string
): Promise<XmlElement[]> {
    const found: XmlElement[] = [];
    await streamXmlElements(source, name, el => found.push(el));
    return found;
}

const DOC =
    '<?xml version="1.0"?><root xmlns="urn:x"><item><a>1</a><b><c> two </c></b></item><skip>no</skip><item><a>3</a></item></root>';

describe('streamXmlElements', () => {
    describe('element extraction', () => {
        it('emits each matching element with its children and trimmed text', async () => {
            const items = await collect([DOC], 'item');
            expect(items).toHaveLength(2);
            expect(xmlChildText(items[0] as XmlElement, 'a')).toBe('1');
            expect(xmlChildText(items[0] as XmlElement, 'b', 'c')).toBe('two');
            expect(xmlChildText(items[1] as XmlElement, 'a')).toBe('3');
        });

        it('ignores elements that are not the requested name', async () => {
            const skipped = await collect([DOC], 'missing');
            expect(skipped).toEqual([]);
        });

        it('returns null for a missing or empty path', async () => {
            const [item] = await collect(
                ['<r><item><e></e></item></r>'],
                'item'
            );
            expect(xmlChildText(item as XmlElement, 'e')).toBeNull();
            expect(xmlChildText(item as XmlElement, 'nope', 'x')).toBeNull();
        });
    });

    describe('namespace prefixes', () => {
        it('strips prefixes so prefixed and unprefixed documents parse the same', async () => {
            const prefixed = DOC.replace(/<(\/?)(item|a|b|c)>/g, '<$1ns1:$2>');
            const [item] = await collect([prefixed], 'item');
            expect(item?.name).toBe('item');
            expect(xmlChildText(item as XmlElement, 'b', 'c')).toBe('two');
        });
    });

    describe('chunked input', () => {
        it('gives the same result when bytes are split at every size, including mid-character', async () => {
            const text = DOC.replace('two', '한글두');
            for (const size of [1, 2, 3, 7, 64]) {
                const items = await collect(asChunks(text, size), 'item');
                expect(items).toHaveLength(2);
                expect(xmlChildText(items[0] as XmlElement, 'b', 'c')).toBe(
                    '한글두'
                );
            }
        });

        it('does not hold the document: elements are delivered before the stream ends', async () => {
            const delivered: number[] = [];
            let chunksRead = 0;
            async function* source(): AsyncGenerator<string> {
                yield '<r><item><a>1</a></item>';
                chunksRead = 1;
                yield '<item><a>2</a></item></r>';
                chunksRead = 2;
            }
            await streamXmlElements(source(), 'item', () =>
                delivered.push(chunksRead)
            );
            expect(delivered).toEqual([0, 1]);
        });
    });

    describe('errors', () => {
        it('rejects malformed XML', async () => {
            await expect(
                collect(['<r><item><a>1</item></r>'], 'item')
            ).rejects.toThrow();
        });

        it('propagates an error thrown by the element callback', async () => {
            await expect(
                streamXmlElements([DOC], 'item', () => {
                    throw new Error('boom');
                })
            ).rejects.toThrow('boom');
        });

        it('rejects documents nested deeper than the limit', async () => {
            const deep = `<item>${'<d>'.repeat(40)}x${'</d>'.repeat(40)}</item>`;
            await expect(collect([deep], 'item')).rejects.toThrow(
                'nesting too deep'
            );
        });
    });
});
