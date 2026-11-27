#!/usr/bin/env node
// 평가용 dev 서버가 쓸 DB·Redis 주소가 모두 로컬인지 시작 전에 확인한다(dev-server.sh가 부른다).
//
// 서버는 `.env.e2e`로 시작하지만, 호출한 셸에서 같은 이름의 변수를 주면 그 값이 `.env.e2e`보다 우선한다. 그 값이 운영
// DB나 Redis를 가리키면 평가가 운영에 캐시·한도 키와 대화 행을 쓰게 된다. 그래서 서버가 실제로 쓸 값(셸 값이 있으면
// 그것, 없으면 `.env.e2e`의 값)을 구해 호스트를 본다.
//
// 앱이 읽는 주소 변수: DATABASE_URL(Postgres), UPSTASH_REDIS_REST_URL(Redis REST). 앱 소스에서 이 둘 말고 Redis·KV
// 주소를 읽는 변수는 없다(`REDIS_URL`·`KV_*` 등은 쓰지 않는다).
//
// 출력은 `이름 -> 호스트:포트`뿐이다. 자격 증명·토큰·경로는 절대 출력하지 않는다.
// 사용: node scripts/agent-eval/localGuard.mjs [DATABASE_URL UPSTASH_REDIS_REST_URL]  (종료 코드 0 통과, 2 거절)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** 검사할 변수 이름(앱이 읽는 DB·Redis 주소). */
export const GUARDED_VARIABLES = ['DATABASE_URL', 'UPSTASH_REDIS_REST_URL'];

/** `.env` 본문에서 한 키의 값만 꺼낸다(`export ` 접두와 따옴표 허용). 없으면 undefined. 다른 줄은 읽지 않는다. */
export function readEnvFileValue(text, name) {
    const prefix = new RegExp(`^\\s*(?:export\\s+)?${name}=(.*)$`);
    const line = text
        .split('\n')
        .map(l => l.match(prefix))
        .filter(m => m !== null)
        .at(-1);
    return line?.[1].trim().replace(/^["']|["']$/g, '');
}

/** 서버가 실제로 쓸 값: 셸 값이 비어 있지 않으면 그것, 아니면 `.env.e2e`의 값. */
export function effectiveValue(name, env, e2eText) {
    const shell = env[name];
    return shell !== undefined && shell !== ''
        ? shell
        : readEnvFileValue(e2eText, name);
}

/** 허용하는 호스트 이름. `URL.hostname`은 IPv6를 대괄호째 돌려준다. */
const STRICT_LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/**
 * DB·Redis 주소용 엄격한 로컬 판정. 호스트 이름이 정확히 localhost / 127.0.0.1 / ::1일 때만 참이다.
 *
 * 사이트 주소에 쓰는 `isLocalUrl`(checks.mjs)은 `ai.localhost` 같은 `*.localhost`도 받아 주는데, 여기서는 일부러
 * 쓰지 않는다. 이 검사는 운영 DB·Redis에 쓰기 전 마지막 문턱이라 안내 문구에 적은 세 호스트만 통과시킨다.
 * `URL`로 해석하므로 `http://localhost@remote.example.com/`의 호스트는 `remote.example.com`이고,
 * `localhost.`(끝점)과 `db.localhost`는 목록에 없어 거절된다.
 */
export function isStrictLocalAddress(value) {
    try {
        return STRICT_LOCAL_HOSTNAMES.includes(new URL(value).hostname);
    } catch {
        return false;
    }
}

/** 주소에서 `호스트:포트`만 꺼낸다(자격 증명·경로·쿼리는 버린다). 해석할 수 없으면 null. */
export function hostPortOf(value) {
    try {
        const { host } = new URL(value);
        return host === '' ? null : host;
    } catch {
        return null;
    }
}

/**
 * 변수 하나를 판정한다. 값이 없거나 로컬이 아니면 ok=false. `hostPort`는 출력해도 안전한 값만 담는다
 * (해석에 실패하면 null이라 원문이 새지 않는다).
 */
export function checkLocalEndpoint(name, value) {
    if (value === undefined || value === '')
        return { name, ok: false, hostPort: null, reason: 'not set' };
    const hostPort = hostPortOf(value);
    return isStrictLocalAddress(value)
        ? { name, ok: true, hostPort, reason: null }
        : { name, ok: false, hostPort, reason: 'not local' };
}

/**
 * @param {string[]} names
 * @param {Record<string, string | undefined>} env
 * @param {string} e2eText
 * @returns {{ name: string, ok: boolean, hostPort: string | null, reason: string | null }[]}
 */
export function checkAll(names, env, e2eText) {
    return names.map(name =>
        checkLocalEndpoint(name, effectiveValue(name, env, e2eText))
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const names =
        process.argv.length > 2 ? process.argv.slice(2) : GUARDED_VARIABLES;
    let e2eText = '';
    try {
        e2eText = readFileSync('.env.e2e', 'utf8');
    } catch {
        process.stderr.write('missing .env.e2e\n');
        process.exit(2);
    }
    const results = checkAll(names, process.env, e2eText);
    results.forEach(r =>
        process.stdout.write(
            `agent-eval dev server: ${r.name} -> ${r.hostPort ?? '(unreadable)'}\n`
        )
    );
    const bad = results.filter(r => !r.ok);
    if (bad.length > 0) {
        process.stderr.write(
            `refusing to start: ${bad.map(r => `${r.name} is ${r.reason}`).join(', ')} (only localhost / 127.0.0.1 / ::1 are allowed)\n`
        );
        process.exit(2);
    }
}
