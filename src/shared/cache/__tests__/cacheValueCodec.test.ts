import { randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
    COMPRESSED_VALUE_PREFIX,
    COMPRESSION_MIN_BYTES,
    decodeCacheValue,
    encodeCacheValue,
} from '@/shared/cache/cacheValueCodec';

/** 운영 `bars:eodhist` 값과 같은 모양의 봉 배열 envelope. */
function barsEnvelope(count: number): { data: unknown[] } {
    return {
        data: Array.from({ length: count }, (_, i) => ({
            time: 1727308800 + i * 86400,
            open: 48.99 + i / 7,
            high: 49.5 + i / 7,
            low: 48.1 + i / 7,
            close: 49.03 + i / 7,
            volume: 1000 + i,
        })),
    };
}

describe('encodeCacheValue 함수는', () => {
    it('직렬화 크기가 임계값 미만이면 값을 그대로 돌려준다', async () => {
        const value = { data: 'small' };

        expect(await encodeCacheValue(value)).toBe(value);
    });

    it('JSON으로 표현되지 않는 값(undefined)은 그대로 돌려준다', async () => {
        expect(await encodeCacheValue(undefined)).toBeUndefined();
    });

    it('큰 값은 압축 표지가 붙은, 원본 JSON보다 짧은 문자열로 만든다', async () => {
        const value = barsEnvelope(500);
        const jsonBytes = Buffer.byteLength(JSON.stringify(value));
        expect(jsonBytes).toBeGreaterThan(COMPRESSION_MIN_BYTES);

        const encoded = await encodeCacheValue(value);

        expect(typeof encoded).toBe('string');
        expect(encoded as string).toMatch(
            new RegExp(`^${COMPRESSED_VALUE_PREFIX}[A-Za-z0-9+/=]+$`)
        );
        expect((encoded as string).length).toBeLessThan(jsonBytes / 2);
    });

    // `{"data":"` + n자 + `"}` = n + 11바이트(ASCII).
    it('직렬화가 정확히 1023바이트면 그대로, 1024바이트면 압축한다', async () => {
        const below = { data: 'a'.repeat(COMPRESSION_MIN_BYTES - 12) };
        const atThreshold = { data: 'a'.repeat(COMPRESSION_MIN_BYTES - 11) };
        expect(Buffer.byteLength(JSON.stringify(below))).toBe(1023);
        expect(Buffer.byteLength(JSON.stringify(atThreshold))).toBe(1024);

        expect(await encodeCacheValue(below)).toBe(below);
        expect(await encodeCacheValue(atThreshold)).toMatch(
            new RegExp(`^${COMPRESSED_VALUE_PREFIX}`)
        );
    });

    it('임계값을 글자 수가 아니라 UTF-8 바이트로 판정한다(한글 411자 = 1211바이트)', async () => {
        const value = { data: '가'.repeat(400) };
        expect(JSON.stringify(value).length).toBeLessThan(
            COMPRESSION_MIN_BYTES
        );

        expect(await encodeCacheValue(value)).toMatch(
            new RegExp(`^${COMPRESSED_VALUE_PREFIX}`)
        );
    });

    it('압축 이득도 글자 수가 아니라 UTF-8 바이트와 비교한다', async () => {
        // 고정 시드 LCG로 고른 한글 음절 — 압축 결과(base64)가 원본 글자 수보다는 길고
        // 원본 바이트 수보다는 짧은 구간에 들어가, 비교 기준이 바뀌면 결과가 뒤집힌다.
        const nextSeed = (seed: number): number =>
            (seed * 1103515245 + 12345) % 2 ** 31;
        const seeds = Array.from({ length: 1200 }).reduce<number[]>(
            (acc, _, i) => [...acc, nextSeed(i === 0 ? 42 : acc[i - 1])],
            []
        );
        const value = {
            data: seeds
                .map(seed => String.fromCharCode(0xac00 + (seed % 11172)))
                .join(''),
        };
        const json = JSON.stringify(value);

        const encoded = await encodeCacheValue(value);

        expect(typeof encoded).toBe('string');
        expect((encoded as string).length).toBeGreaterThan(json.length);
        expect((encoded as string).length).toBeLessThan(
            Buffer.byteLength(json)
        );
    });

    it('압축해도 줄지 않는 큰 값은 그대로 돌려준다', async () => {
        // 난수 바이트의 base64는 zstd로 거의 줄지 않고, 다시 base64로 감싸면 커진다.
        const value = { data: randomBytes(4096).toString('base64') };

        expect(await encodeCacheValue(value)).toBe(value);
    });
});

describe('decodeCacheValue 함수는', () => {
    it('encodeCacheValue로 압축한 값을 원래 값으로 되돌린다(한글 포함)', async () => {
        const value = {
            data: {
                ...barsEnvelope(300),
                note: '알파 테크노바 현재가 9.08달러',
            },
        };

        const decoded = await decodeCacheValue(await encodeCacheValue(value));

        expect(decoded).toEqual(value);
    });

    it.each([
        ['null(miss)', null],
        ['압축 전 envelope 객체', { data: [1, 2, 3] }],
        ['표지 없는 문자열', 'plain-string'],
        ['숫자', 42],
    ])('압축 표지가 없는 %s는 그대로 통과시킨다', async (_label, raw) => {
        expect(await decodeCacheValue(raw)).toBe(raw);
    });

    it('압축 표지가 있는데 해독할 수 없으면 throw한다', async () => {
        await expect(
            decodeCacheValue(`${COMPRESSED_VALUE_PREFIX}bm90LXpzdGQ=`)
        ).rejects.toThrow();
    });
});
