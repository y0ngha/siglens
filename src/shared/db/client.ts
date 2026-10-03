import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readDatabaseConfig, tryReadDatabaseConfig } from './config';
import { noStoreQueryLogger } from './noStoreQueryLogger';
import * as schema from './schema';
import type { DatabaseClient, DatabaseConfig } from './types';
import {
    assertOnline,
    isOfflineBuild,
    warnOfflineBuildOnce,
    OFFLINE_BUILD_SERVICE,
} from '@/shared/api/offlineBuild';

/**
 * 클라이언트 캐시의 `globalThis` 키.
 *
 * 모듈 변수만 쓰면 HMR(dev)이나 번들이 같은 모듈을 둘 이상 평가하는 경우마다 풀이 하나씩
 * 더 열려 커넥션이 `DB_POOL_MAX`의 배수로 샌다. `Symbol.for`는 모듈 인스턴스가 달라도 같은
 * 전역 키를 가리킨다.
 */
const CLIENT_CACHE_KEY = Symbol.for('siglens.databaseClient');

type ClientCache = Record<symbol, DatabaseClient | null | undefined>;

// 안전한 캐스트 근거: `globalThis`에는 우리 심볼 키 선언이 없고, 이 키는 아래 두 헬퍼만 읽고 쓴다.
const clientCache = globalThis as unknown as ClientCache;

function readCachedClient(): DatabaseClient | null {
    return clientCache[CLIENT_CACHE_KEY] ?? null;
}

function writeCachedClient(client: DatabaseClient | null): void {
    clientCache[CLIENT_CACHE_KEY] = client;
}

/**
 * 인스턴스(컨테이너) 하나가 DB로 여는 최대 커넥션 수.
 *
 * 서버는 장수 Node 프로세스 하나라 요청마다 커넥션을 새로 여는 HTTP 드라이버와 달리
 * 풀을 공유한다. 동시 쿼리가 이 수를 넘으면 postgres-js가 큐에 쌓아 순서대로 흘린다.
 *
 * 커넥션 예산(RDS `db.t4g.small`, `max_connections` ≈ 180 기준):
 *   10(DB_POOL_MAX) × 4(ASG max) × 2(롤링 배포 중 신·구 인스턴스 겹침) = 80
 * 남는 100 안팎은 마이그레이션·관리 도구·운영 접속(trader/admin)과 `max_lifetime`
 * 교체 순간의 일시 초과를 위한 여유다. 인스턴스 수나 이 값을 올릴 때 위 곱셈을 다시 계산할 것.
 */
export const DB_POOL_MAX = 10;

/** 유휴 커넥션을 닫기까지의 초. Neon이 유휴 컴퓨트를 내리기 전에 풀이 먼저 정리한다. */
const IDLE_TIMEOUT_SECONDS = 20;

/** 커넥션 수립 제한 시간(초). 넘으면 `CONNECT_TIMEOUT`(재시도 대상)으로 실패한다. */
const CONNECT_TIMEOUT_SECONDS = 10;

/**
 * 커넥션 최대 수명(초). 오래 산 커넥션을 주기적으로 갈아 끼워 서버 쪽 장애조치·DNS
 * 변경(RDS) 이후에도 죽은 소켓에 계속 쓰지 않게 한다.
 */
const MAX_LIFETIME_SECONDS = 60 * 30;

/**
 * TLS 검증을 강제하지 않는 로컬 호스트. 로컬/CI Postgres는 TLS가 없고(`sslmode` 없음),
 * 있어도 자체 서명이라 검증할 수 없다 — 이 호스트들은 URL이 말하는 대로 둔다.
 */
const LOCAL_DB_HOSTS: ReadonlySet<string> = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
    'postgres',
    'host.docker.internal',
]);

/**
 * postgres-js가 `sslmode`를 "암호화만 하고 인증서는 검증하지 않음"으로 해석하는 값들.
 * (`connection.js`: `require`/`allow`/`prefer` → `rejectUnauthorized = false`)
 */
const UNVERIFIED_SSLMODES: ReadonlySet<string> = new Set([
    'require',
    'allow',
    'prefer',
]);

/**
 * postgres-js가 **직접 이해하지 못해** 서버 startup 파라미터로 그대로 흘려보내는
 * libpq 전용 쿼리 파라미터. 서버는 이를 모르는 GUC로 보고 `unrecognized configuration
 * parameter`로 접속을 거부한다.
 *
 * `sslmode`·`sslnegotiation`·`target_session_attrs`는 postgres-js가 알고 있어 여기 없다.
 * `sslrootcert=system`은 postgres-js가 `verify-full`로 해석하는 값이라 {@link resolveSslOption}이
 * 먼저 읽고, 그 외 `sslrootcert` 경로 값은 여기서 뗀다(CA는 `NODE_EXTRA_CA_CERTS`로 준다).
 */
const LIBPQ_ONLY_PARAMS: readonly string[] = [
    'channel_binding',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'sslcrl',
    'sslpassword',
    'gssencmode',
];

function parseUrl(databaseUrl: string): URL | null {
    try {
        return new URL(databaseUrl);
    } catch {
        return null;
    }
}

/** 로컬 개발·CI·E2E용 호스트인지(TLS 검증 대상이 아님). */
export function isLocalDbHost(hostname: string): boolean {
    return LOCAL_DB_HOSTS.has(hostname.toLowerCase());
}

/**
 * Neon pooler 호스트(`…-pooler.…neon.tech`)인지. pooler는 PgBouncer **transaction
 * 모드**라 세션에 묶이는 서버측 prepared statement를 쓸 수 없다 — 그 경우
 * postgres-js의 `prepare`를 꺼야 한다.
 */
export function isPooledConnectionUrl(databaseUrl: string): boolean {
    return parseUrl(databaseUrl)?.hostname.includes('-pooler.') ?? false;
}

/**
 * prepared statement 사용 여부. 기본은 pooler 호스트에서만 끈다. `DATABASE_PREPARE`
 * (`true`/`false`)가 있으면 그 값이 우선한다 — 예를 들어 RDS 앞에 PgBouncer(transaction
 * 모드)를 두게 되면 `false`로 끈다. 다른 값은 무시하고 기본 규칙을 쓴다.
 */
export function resolvePrepare(
    databaseUrl: string,
    override: string | undefined = process.env.DATABASE_PREPARE
): boolean {
    if (override === 'true') return true;
    if (override === 'false') return false;
    return !isPooledConnectionUrl(databaseUrl);
}

/**
 * 원격 호스트의 TLS 검증 수준을 정한다. `'verify-full'`이면 호출부가 postgres-js `ssl`
 * 옵션으로 넘기고, `undefined`면 URL이 말하는 대로 둔다.
 *
 * 왜 필요한가: 예전 neon-http는 항상 HTTPS 전체 검증(체인 + 호스트명)이었다. postgres-js는
 * Neon 콘솔 URL의 `sslmode=require`를 `rejectUnauthorized: false`로 해석해 **암호화는
 * 하되 서버 신원은 검증하지 않는다** — MITM에 열린 다운그레이드다. 그래서 로컬이 아닌
 * 호스트의 `require`/`prefer`/`allow`는 `verify-full`로 끌어올린다. Neon은 공개 CA라 그대로
 * 통과하고, RDS는 `NODE_EXTRA_CA_CERTS`의 CA 번들로 통과한다.
 *
 * `sslmode`가 없거나 `disable`/`verify-*`이면 건드리지 않는다(`verify-*`는 postgres-js가
 * 이미 검증한다). `sslrootcert=system`만 있고 `sslmode`가 없는 경우는 postgres-js가
 * `verify-full`로 읽으므로, 그 파라미터를 뗀 뒤에도 같은 결과가 되게 여기서 옮겨 준다.
 */
export function resolveSslOption(
    databaseUrl: string
): 'verify-full' | undefined {
    const url = parseUrl(databaseUrl);
    if (url === null || isLocalDbHost(url.hostname)) return undefined;
    const mode = url.searchParams.get('sslmode');
    if (mode !== null && UNVERIFIED_SSLMODES.has(mode)) return 'verify-full';
    if (mode === null && url.searchParams.get('sslrootcert') === 'system') {
        return 'verify-full';
    }
    return undefined;
}

/**
 * postgres-js가 모르는 libpq 전용 쿼리 파라미터({@link LIBPQ_ONLY_PARAMS})를 URL에서 뗀다.
 *
 * Neon 콘솔이 주는 연결 문자열의 `channel_binding=require`가 대표 사례다. postgres-js는
 * channel binding 없이 SCRAM을 수행하고 서버는 이를 강제하지 않으므로 떼어도 접속·인증은
 * 그대로다. 호출 순서 주의: {@link resolveSslOption}이 `sslrootcert`를 읽으므로 **그 뒤에** 부른다.
 */
export function stripLibpqOnlyParams(databaseUrl: string): string {
    const url = parseUrl(databaseUrl);
    if (url === null) return databaseUrl;
    const present = LIBPQ_ONLY_PARAMS.filter(key => url.searchParams.has(key));
    if (present.length === 0) return databaseUrl;
    present.forEach(key => url.searchParams.delete(key));
    return url.toString();
}

/**
 * postgres-js(TCP) + drizzle 클라이언트를 만든다.
 *
 * 기대하는 URL 형태:
 *   - Neon(현재): `postgresql://user:pass@<endpoint>-pooler.<region>.aws.neon.tech/db?sslmode=require&channel_binding=require`
 *     → `sslmode=require`는 `verify-full`로 끌어올려지고(체인 + 호스트명 검증),
 *       `channel_binding`은 떼며, pooler 호스트라 `prepare`가 꺼진다.
 *   - RDS(이전 후): `postgresql://user:pass@<endpoint>:5432/siglens?sslmode=verify-full`
 *     → CA는 이미지의 `NODE_EXTRA_CA_CERTS`(RDS 글로벌 번들, Dockerfile 참조)로 신뢰한다.
 *   - 로컬/E2E: `postgres://user:pass@localhost:5434/db` (`sslmode` 없음) → 평문 그대로.
 *
 * drizzle 로거로 {@link noStoreQueryLogger}를 꽂아, `fetch`를 쓰지 않는 TCP
 * 드라이버에서도 예전 neon-http의 no-store 신호(정적 생성 중 `unstable_cache` 밖
 * DB 읽기 → 동적 전환)를 유지한다. 근거는 그 파일의 JSDoc 참조.
 */
export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
    const ssl = resolveSslOption(config.databaseUrl);
    const sql = postgres(stripLibpqOnlyParams(config.databaseUrl), {
        max: DB_POOL_MAX,
        idle_timeout: IDLE_TIMEOUT_SECONDS,
        connect_timeout: CONNECT_TIMEOUT_SECONDS,
        max_lifetime: MAX_LIFETIME_SECONDS,
        prepare: resolvePrepare(config.databaseUrl),
        ...(ssl === undefined ? {} : { ssl }),
    });
    const db = drizzle(sql, { schema, logger: noStoreQueryLogger });
    return { db, sql };
}

/**
 * Returns the cached `DatabaseClient`, creating it on first call; throws when
 * `DATABASE_URL` is unset, or when `SIGLENS_OFFLINE_BUILD=1` (blocks the DB
 * connection before `postgres()` is ever constructed).
 */
export function getDatabaseClient(): DatabaseClient {
    assertOnline(OFFLINE_BUILD_SERVICE.DATABASE, 'connection');
    const client =
        readCachedClient() ?? createDatabaseClient(readDatabaseConfig());
    writeCachedClient(client);
    return client;
}

/**
 * Returns the cached `DatabaseClient`, or `null` when `DATABASE_URL` is
 * absent (graceful degradation), or when `SIGLENS_OFFLINE_BUILD=1` (blocks
 * the DB connection before `postgres()` is ever constructed).
 */
export function tryGetDatabaseClient(): DatabaseClient | null {
    if (isOfflineBuild()) {
        warnOfflineBuildOnce(OFFLINE_BUILD_SERVICE.DATABASE);
        return null;
    }
    const config = tryReadDatabaseConfig();
    if (config === null) return null;
    const client = readCachedClient() ?? createDatabaseClient(config);
    writeCachedClient(client);
    return client;
}

/**
 * 캐시된 풀을 닫는다(없으면 no-op). 진행 중 쿼리는 `timeoutSeconds`까지 기다린다.
 *
 * 쓰는 곳: 서버 SIGTERM drain 뒤(`instrumentation.node.ts`)와 DB를 잠깐 쓰고 끝나는
 * CLI 스크립트. 풀을 안 닫으면 유휴 소켓(`idle_timeout` 20초)이 이벤트 루프를 잡아 CLI가
 * 그만큼 늦게 끝난다. 캐시를 먼저 비우므로 이후 `getDatabaseClient()`는 새 풀을 만든다.
 * 종료 실패는 삼키고 경고만 남긴다(best-effort).
 */
export async function endDatabaseClient(timeoutSeconds = 5): Promise<void> {
    const client = readCachedClient();
    if (client === null) return;
    writeCachedClient(null);
    try {
        await client.sql.end({ timeout: timeoutSeconds });
    } catch (error) {
        console.warn('[db] failed to end connection pool', error);
    }
}

/** @internal Resets the cached client between test runs. */
export function resetDatabaseClientForTests(): void {
    writeCachedClient(null);
}
