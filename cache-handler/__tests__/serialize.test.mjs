import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../serialize.mjs';

describe('serialize', () => {
    it('gzip 왕복이 원본과 동치다', async () => {
        const obj = {
            value: { html: 'x'.repeat(1000) },
            lastModified: 123,
            tags: ['symbol:AAPL'],
        };
        const buf = await serialize(obj);
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(await deserialize(buf)).toEqual(obj);
    });

    it('빈 객체도 왕복된다', async () => {
        expect(await deserialize(await serialize({}))).toEqual({});
    });

    it('Buffer(rscData)와 Map<string,Buffer>(segmentData)를 보존한다', async () => {
        // Next 16.2 APP_PAGE 값 모양 — JSON.stringify면 Buffer/Map이 깨진다.
        const obj = {
            value: {
                kind: 'APP_PAGE',
                html: '<p>hi</p>',
                rscData: Buffer.from('rsc'),
                segmentData: new Map([['a', Buffer.from('x')]]),
            },
            lastModified: 1,
            tags: ['symbol:AAPL'],
        };
        const out = await deserialize(await serialize(obj));

        // 타입이 보존돼야 한다(JSON이면 plain object/array로 변형됨).
        // 주의: vmThreads 풀에선 코드가 별도 realm에서 실행돼 `instanceof Map`이
        // 다른 realm 생성자로 인해 false가 될 수 있다. realm-safe한
        // Object.prototype.toString 태그로 타입을 검증한다.
        expect(Buffer.isBuffer(out.value.rscData)).toBe(true);
        expect(Object.prototype.toString.call(out.value.segmentData)).toBe(
            '[object Map]'
        );
        expect(Buffer.isBuffer(out.value.segmentData.get('a'))).toBe(true);

        // 내용 동치 검증. (vitest toEqual은 vmThreads cross-realm에서 Map 비교가
        // 생성자 realm 차이로 불일치하므로, 필드별로 명시 비교한다.)
        expect(out.value.kind).toBe('APP_PAGE');
        expect(out.value.html).toBe('<p>hi</p>');
        expect(out.lastModified).toBe(1);
        expect(out.tags).toEqual(['symbol:AAPL']);
        expect(out.value.rscData.equals(Buffer.from('rsc'))).toBe(true);
        expect([...out.value.segmentData.keys()]).toEqual(['a']);
        expect(out.value.segmentData.get('a').equals(Buffer.from('x'))).toBe(
            true
        );
    });

    it('APP_ROUTE body(Buffer)도 보존한다', async () => {
        const obj = {
            value: {
                kind: 'APP_ROUTE',
                body: Buffer.from([1, 2, 3]),
                status: 200,
            },
            lastModified: 2,
            tags: [],
        };
        const out = await deserialize(await serialize(obj));
        expect(Buffer.isBuffer(out.value.body)).toBe(true);
        expect(out.value.body.equals(Buffer.from([1, 2, 3]))).toBe(true);
    });
});
