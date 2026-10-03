import { describe, it, expect, vi, afterEach } from 'vitest';
import { Redis } from '@upstash/redis';
import {
    COMPRESSED_VALUE_PREFIX,
    decodeCacheValue,
    encodeCacheValue,
} from '@/shared/cache/cacheValueCodec';

/**
 * 압축 설계가 기대는 @upstash/redis 계약을 고정한다: SET은 문자열을 그대로 보내고,
 * GET은 JSON으로 파싱되지 않는 문자열을 원문 그대로 돌려준다. 이 계약이 클라이언트
 * 업그레이드로 깨지면 압축 키가 전부 영구 miss가 되는데, 메모리 스텁을 쓰는 다른
 * 테스트는 이를 잡지 못한다.
 *
 * 운영과 같은 옵션(`new Redis({ url, token })` — 자동 파이프라이닝·base64 응답 인코딩
 * 기본값)으로 만든 실제 클라이언트에, Upstash REST 서버를 흉내 내는 fetch를 붙인다.
 * 모르는 요청은 throw해 실제 네트워크로 새지 않게 한다.
 */
function stubUpstashRest(): Map<string, string> {
    const store = new Map<string, string>();

    const execute = (command: unknown[]): unknown => {
        const [name, key, value] = command as [string, string, unknown];
        switch (name.toLowerCase()) {
            case 'set':
                store.set(key, String(value));
                return 'OK';
            case 'get':
                return store.get(key) ?? null;
            default:
                throw new Error(`unexpected Upstash command in test: ${name}`);
        }
    };

    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (!url.startsWith('https://contract-test.upstash.io')) {
                throw new Error(`unexpected fetch in test: ${url}`);
            }
            const headers = new Headers(init?.headers);
            const base64 = headers.get('Upstash-Encoding') === 'base64';
            const encode = (result: unknown): unknown =>
                base64 && typeof result === 'string' && result !== 'OK'
                    ? Buffer.from(result, 'utf8').toString('base64')
                    : result;

            const body = JSON.parse(String(init?.body)) as unknown[];
            const payload = url.endsWith('/pipeline')
                ? (body as unknown[][]).map(cmd => ({
                      result: encode(execute(cmd)),
                  }))
                : { result: encode(execute(body)) };
            return new Response(JSON.stringify(payload), { status: 200 });
        })
    );
    return store;
}

function createClient(): Redis {
    return new Redis({
        url: 'https://contract-test.upstash.io',
        token: 'contract-test-token',
    });
}

describe('@upstash/redis 클라이언트와 압축 값의 계약은', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('SET이 압축 문자열을 바이트 그대로 저장하고 GET이 원문 그대로 돌려줘 원래 값으로 복원된다', async () => {
        const store = stubUpstashRest();
        const redis = createClient();
        const value = {
            data: Array.from({ length: 200 }, (_, i) => ({
                time: 1727308800 + i * 86400,
                close: 49.03 + i / 7,
            })),
        };
        const encoded = await encodeCacheValue(value);
        expect(encoded as string).toMatch(
            new RegExp(`^${COMPRESSED_VALUE_PREFIX}`)
        );

        await redis.set('bars:eodhist:AAPL:2026-10-02', encoded, { ex: 60 });
        const raw = await redis.get<unknown>('bars:eodhist:AAPL:2026-10-02');

        expect(store.get('bars:eodhist:AAPL:2026-10-02')).toBe(encoded);
        expect(raw).toBe(encoded);
        expect(await decodeCacheValue(raw)).toEqual(value);
    });

    it('임계값 미만 envelope은 지금처럼 JSON으로 저장되고 객체로 읽힌다', async () => {
        const store = stubUpstashRest();
        const redis = createClient();
        const value = { data: { symbol: 'AAPL' } };

        await redis.set('quote:AAPL', await encodeCacheValue(value), {
            ex: 60,
        });
        const raw = await redis.get<unknown>('quote:AAPL');

        expect(store.get('quote:AAPL')).toBe(JSON.stringify(value));
        expect(await decodeCacheValue(raw)).toEqual(value);
    });
});
