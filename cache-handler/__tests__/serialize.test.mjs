import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../serialize.mjs';

describe('serialize', () => {
    it('gzip 왕복이 원본과 동치다', () => {
        const obj = {
            value: { html: 'x'.repeat(1000) },
            lastModified: 123,
            tags: ['symbol:AAPL'],
        };
        const buf = serialize(obj);
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(deserialize(buf)).toEqual(obj);
    });

    it('빈 객체도 왕복된다', () => {
        expect(deserialize(serialize({}))).toEqual({});
    });
});
