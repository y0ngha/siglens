// Upstash Redis REST 최소 클라이언트 — cache-handler 전용.
//
// ⚠️ 전역 `fetch`를 쓰지 않는다. 이것이 이 모듈에서 가장 중요한 제약이다.
//
// Next.js는 `patchFetch()`로 `globalThis.fetch`를 교체한다(next/dist/server/lib/patch-fetch.js).
// 캐시 핸들러의 `get()`은 렌더의 `workUnitAsyncStorage` 컨텍스트 안에서 실행되므로, 여기서
// 전역 fetch를 호출하면 패치된 fetch가 이를 "페이지가 수행한 데이터 요청"으로 오인한다:
//   - `cache: 'no-store'` 등 명시적 opt-out이 있으면 `DynamicServerError`를 던지는데,
//     **던지기 전에 `workUnitStore.revalidate = 0`을 설정**한다. 예외를 catch로 삼켜도
//     부수효과는 남아 해당 페이지가 ISR 캐시에 기록되지 않고 no-store로 서빙된다
//     (= 이 캐시 핸들러가 존재하는 이유인 디스크·Fast Origin Transfer 문제의 재발).
//   - `cacheComponents`(PPR) 활성 시에는 **영원히 settle되지 않는 promise**를 반환한다
//     (patch-fetch.js `makeHangingPromise`). AbortSignal로도 구제되지 않는다.
//
// 그래서 `node:http`/`node:https`를 직접 쓴다 — `s3Store.mjs`가 AWS SDK(node:http 기반)를
// 쓰는 것과 같은 이유로, 프레임워크가 패치하는 전역에서 벗어나 있어야 한다.
//
// `@upstash/redis` 패키지도 쓰지 않는다: Dockerfile runner 스테이지는 node_modules에서
// sharp / @aws-sdk / @smithy / @aws-crypto / tslib만 명시 COPY한다(Dockerfile:65-76).
// 필요한 명령이 ZADD / ZRANGE / ZREMRANGEBYSCORE / EXPIRE / TIME 뿐이라 직접 호출이 낫다.
// 앱 코드(src/shared/cache/redisClient.ts)는 계속 패키지를 쓴다 — 이 모듈은 번들 밖
// 평문 ESM이라 src/를 import할 수도 없다.
//
// 프로토콜: POST {REST_URL} body=["CMD","arg",...] / Authorization: Bearer {token}
// 응답: {"result": ...} 또는 {"error": "..."}.
// 주의: 패키지 클라이언트와 달리 REST 원형은 응답에 JSON.parse를 적용하지 않는다 —
// 저장한 문자열이 그대로 돌아온다. (패키지 쪽 자동 역직렬화가 SEO pre-warm 락에서
// '1'을 숫자 1로 바꿔 비교 분기를 死코드로 만든 사례가 있었다.)

import http from 'node:http';
import https from 'node:https';

const TIMEOUT_MS = 2_000;

// undefined = 미초기화, null = 미설정(graceful no-op).
let cachedEnv;

function readEnv() {
    // 운영 킬스위치 — 재배포 없이 태그 동기화만 끌 수 있다. ISR_CACHE_DISABLED는 S3
    // 핸들러 전체를 끄기 때문에(디스크 리스크 복귀) 이 기능만 끄는 레버가 따로 필요하다.
    if (process.env.ISR_TAG_SYNC_DISABLED === 'true') return null;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null; // 잘못된 URL은 미설정과 동일하게 취급(로컬 전용 degrade).
    }

    // 읽기 전용 토큰이 있으면 sync 경로에 최소 권한으로 쓴다(앱 redisClient와 동일 관례).
    // 빈 문자열도 falsy라 미설정과 동일하게 쓰기 토큰으로 대체된다.
    const readonly = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    return {
        target: parsed,
        writeToken: token,
        readToken: readonly || token,
    };
}

function getEnv() {
    if (cachedEnv === undefined) cachedEnv = readEnv();
    return cachedEnv;
}

/** Upstash 환경변수가 설정돼 있는지. false면 호출부는 로컬 전용으로 degrade한다. */
export function isUpstashConfigured() {
    return getEnv() !== null;
}

/**
 * node:http(s)로 POST 한 번. 반드시 settle된다 — timeout은 소켓을 destroy해 error로
 * 이어지고, error/response 어느 쪽이든 promise를 종료시킨다.
 */
function post(target, token, body) {
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
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('error', reject);
                response.on('end', () =>
                    resolve({
                        status: response.statusCode,
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

/**
 * 단일 Redis 명령을 실행한다. 실패 시 throw — 호출부(tagStore)가 전부 흡수한다.
 * `readonly: true`면 읽기 전용 토큰을 쓴다.
 */
async function command(args, { readonly = false } = {}) {
    const env = getEnv();
    if (!env) throw new Error('upstash not configured');

    const { status, text } = await post(
        env.target,
        readonly ? env.readToken : env.writeToken,
        JSON.stringify(args.map(String))
    );

    if (status < 200 || status >= 300) {
        throw new Error(`upstash http ${status}`);
    }

    let body;
    try {
        body = JSON.parse(text);
    } catch {
        throw new Error('upstash malformed response');
    }
    if (body && typeof body === 'object' && body.error) {
        throw new Error(`upstash error: ${body.error}`);
    }
    return body?.result;
}

// ZADD 한 번에 넘길 최대 멤버 수. 요청 바디가 무한정 커지지 않도록 상한을 둔다.
const ZADD_CHUNK = 500;

/**
 * 정렬셋에 (score, member)를 기록하되 **기존 score보다 클 때만** 갱신한다(GT).
 * 여러 인스턴스가 동시에 쓸 때 늦게 도착한 오래된 타임스탬프가 최신값을 덮어쓰지
 * 않도록 보장한다 — 단순 ZADD는 실행 순서대로 덮어써서 max semantics가 깨진다.
 *
 * GT는 멱등이므로 호출부가 실패 시 전체를 재시도해도 안전하다.
 */
export async function zaddGreater(key, entries) {
    for (let i = 0; i < entries.length; i += ZADD_CHUNK) {
        const chunk = entries.slice(i, i + ZADD_CHUNK);
        await command([
            'ZADD',
            key,
            'GT',
            ...chunk.flatMap(([score, member]) => [score, member]),
        ]);
    }
}

/**
 * score >= min 인 (member, score) 쌍을 읽는다. 응답은 [m1, s1, m2, s2, ...] 평면 배열.
 *
 * `{ pairs, rawLength }`를 반환한다 — 호출부가 "원소는 왔는데 하나도 해석 못 함"(=와이어
 * 포맷 변경)을 "변경분 없음"과 구분할 수 있어야 하기 때문이다. 그 둘을 뭉뚱그리면 기능이
 * 무동작 상태로 조용히 전환된다.
 *
 * 배열이 아닌 결과는 throw한다 — 빈 배열로 삼키면 호출부가 "변경분 없음"으로 오인해
 * sync 워터마크를 전진시키고, 그 사이의 무효화를 영구히 놓친다.
 */
export async function zrangeFromScore(key, min) {
    const flat = await command(
        ['ZRANGE', key, String(min), '+inf', 'BYSCORE', 'WITHSCORES'],
        { readonly: true }
    );
    if (!Array.isArray(flat)) {
        throw new Error('upstash zrange: non-array result');
    }

    const pairs = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
        const member = flat[i];
        const score = Number(flat[i + 1]);
        // 손상된 엔트리는 조용히 버린다 — 태그 로그 한 줄 때문에 캐시 경로가 죽으면 안 된다.
        if (
            typeof member === 'string' &&
            member.length > 0 &&
            Number.isFinite(score)
        ) {
            pairs.push([member, score]);
        }
    }
    return { pairs, rawLength: flat.length };
}

/** score < max 인 엔트리를 제거한다(보존 기간 지난 태그 정리). */
export async function zremBelowScore(key, max) {
    await command(['ZREMRANGEBYSCORE', key, '-inf', `(${max}`]);
}

/**
 * 키에 만료를 건다. 쓰기마다 갱신되므로 정상 운영 중엔 만료되지 않고, 롤백 등으로
 * 쓰기가 끊기면 스스로 사라져 고아 키가 남지 않는다.
 */
export async function expireKey(key, seconds) {
    await command(['EXPIRE', key, seconds]);
}

/**
 * Redis 서버 시각(ms). 정리 하한을 로컬 시계 대신 여기서 얻는다 — 시계가 크게 앞선
 * 인스턴스 하나가 `ZREMRANGEBYSCORE`로 **공유** 태그 로그 전체를 지워버리는 것을 막는다.
 */
export async function serverTimeMs() {
    const time = await command(['TIME'], { readonly: true });
    if (!Array.isArray(time) || time.length < 2) {
        throw new Error('upstash TIME: unexpected shape');
    }
    const seconds = Number(time[0]);
    const micros = Number(time[1]);
    if (!Number.isFinite(seconds) || !Number.isFinite(micros)) {
        throw new Error('upstash TIME: non-numeric');
    }
    return seconds * 1000 + Math.floor(micros / 1000);
}

/** 테스트 전용 — 환경변수 메모이제이션 초기화. */
export function _resetForTest() {
    cachedEnv = undefined;
}
