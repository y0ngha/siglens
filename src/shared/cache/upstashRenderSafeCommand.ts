import 'server-only';
import http from 'node:http';
import https from 'node:https';
import { getUpstashWriterCredentials } from './redisClient';

const TIMEOUT_MS = 2_000;

interface PostResult {
    readonly status: number;
    readonly text: string;
}

/**
 * Upstash REST 명령 하나를 **전역 `fetch`를 거치지 않고** 실행한다. 정적(ISR) 렌더 안에서
 * Redis에 써야 하는 곳 전용이다.
 *
 * Next는 `globalThis.fetch`를 패치해 렌더 중 `no-store` 요청을 "이 페이지는 동적"이라는
 * 신호로 기록한다. `@upstash/redis`는 그 fetch를 쓰므로, 정적 렌더에서 부르면 재생성이
 * "Page changed from static to dynamic at runtime"으로 실패한다(예외를 잡아도 기록은
 * 남는다). `cache-handler/upstashRest.mjs`가 같은 이유로 `node:http(s)`를 쓰는 것과 같다
 * — 그쪽은 번들 밖 평문 ESM이라 import할 수 없어 여기 따로 둔다.
 *
 * 읽기는 이 경로가 필요 없다: 렌더 중 읽기는 `unstable_cache` 안에서 하면 된다.
 * 쓰기 토큰을 쓰므로 미설정이면 throw — 호출부가 미리 {@link getUpstashWriterCredentials}로
 * 확인하고 흡수한다. 실패도 throw(HTTP 오류, `{"error"}` 응답, 2초 timeout).
 *
 * 프로토콜: POST {REST_URL} body=["CMD","arg",...] / Authorization: Bearer {token}.
 * 응답 `result`는 패키지 클라이언트와 달리 JSON.parse되지 않은 원형이다.
 */
export async function runUpstashCommandOutsideFetch(
    args: readonly (string | number)[]
): Promise<unknown> {
    const credentials = getUpstashWriterCredentials();
    if (credentials === null) throw new Error('upstash not configured');

    const { status, text } = await post(
        new URL(credentials.url),
        credentials.token,
        JSON.stringify(args.map(String))
    );
    if (status < 200 || status >= 300) {
        throw new Error(`upstash http ${status}`);
    }
    const body = JSON.parse(text) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`upstash error: ${body.error}`);
    return body.result;
}

/** POST 한 번. timeout은 소켓을 destroy해 error로 이어지므로 promise는 반드시 settle된다. */
function post(target: URL, token: string, body: string): Promise<PostResult> {
    return new Promise((resolve, reject) => {
        const transport = target.protocol === 'http:' ? http : https;
        const payload = Buffer.from(body, 'utf8');
        const request = transport.request(
            target,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length,
                },
                timeout: TIMEOUT_MS,
            },
            response => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('error', reject);
                response.on('end', () =>
                    resolve({
                        status: response.statusCode ?? 0,
                        text: Buffer.concat(chunks).toString('utf8'),
                    })
                );
            }
        );
        request.on('timeout', () =>
            request.destroy(new Error(`upstash timeout after ${TIMEOUT_MS}ms`))
        );
        request.on('error', reject);
        request.end(payload);
    });
}
