/**
 * DB 스크립트의 **대상 확인 + 원격 쓰기 가드**.
 *
 * `yarn db:*` 스크립트는 전부 `dotenv -e .env.local`로 묶여 있다. RDS 전환 전에는
 * 그 파일이 **운영 Neon 인스턴스를 가리킨다.** 즉 `yarn db:backfill:content-locale
 * --apply` 한 번이면 운영 데이터에 쓴다 — 로컬에 쓰려던 사람이 플래그 하나
 * 잘못 붙이면 되돌릴 수 없는 작업이 나간다.
 *
 * 전환 후 기본 모델은 반대다: `.env.local`은 로컬 Docker Postgres(`yarn db:dev:up`,
 * 포트 5435)를 가리키고, 운영 RDS는 private이라 `yarn db:tunnel`(SSM 포트포워딩)로만
 * 닿는다.
 *
 * ⚠️ 터널은 `localhost:6543`으로 열린다. 호스트 이름만 보면 로컬 Docker와 구별이
 * 안 되므로, **로컬 호스트라도 포트가 `DB_TUNNEL_PORT`면 원격으로 분류한다.**
 * 그러지 않으면 운영으로 향하는 터널이 쓰기 가드를 통째로 열어 버린다. 이 포트는
 * `scripts/db-tunnel.sh`·`scripts/db-dev-seed-from-prod.sh`가 하드코딩한 값과
 * 같아야 한다.
 *
 * 그래서 쓰기 작업은 **원격 대상일 때 기본 거부**한다. 정말 운영에 써야 하면
 * `ALLOW_REMOTE_DB_WRITE=1`을 명시해야 한다 — 실수로 칠 수 있는 값이 아니다.
 *
 * 읽기 전용 스크립트는 막지 않는다. 대신 대상 호스트는 **항상 찍는다** — 어느
 * DB를 봤는지 모르는 채로 "정상"이라고 보고하는 것이 가장 위험하다.
 */

/** 로컬로 간주하는 호스트. docker-compose의 Postgres도 여기 들어온다. */
const LOCAL_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'postgres', // docker-compose service name
    'host.docker.internal',
]);

/**
 * `yarn db:tunnel`(SSM 포트포워딩)이 여는 로컬 포트. 운영 RDS로 이어지므로
 * 이 포트로 향하는 URL은 호스트가 localhost여도 원격이다.
 * `scripts/db-tunnel.sh`의 TUNNEL_PORT와 같은 값이어야 한다.
 */
export const DB_TUNNEL_PORT = 6543;

export interface DbTarget {
    readonly host: string;
    readonly database: string;
    readonly isLocal: boolean;
    /** 로컬 호스트 + 터널 포트 — 운영으로 이어지는 SSM 터널. */
    readonly viaTunnel: boolean;
}

/**
 * 접속 문자열에서 호스트·DB 이름만 뽑는다. **자격증명은 절대 돌려주지 않는다** —
 * 이 값은 로그로 나가고, 로그는 CloudWatch에 남는다.
 */
export function describeTarget(databaseUrl: string): DbTarget {
    let parsed: URL;
    try {
        parsed = new URL(databaseUrl);
    } catch {
        // 파싱 실패는 **로컬로 보지 않는다**. 모양이 이상한 URL을 안전한 쪽으로
        // 넘기면, 가드가 정작 필요한 순간에 열려 버린다.
        return {
            host: '(unparseable)',
            database: '(unknown)',
            isLocal: false,
            viaTunnel: false,
        };
    }
    const host = parsed.hostname;
    // WHATWG URL은 IPv6를 `[::1]`로 돌려준다 — 대괄호를 벗겨야 집합과 맞는다.
    const bareHost = host.replace(/^\[|\]$/g, '');
    const viaTunnel =
        LOCAL_HOSTS.has(bareHost) && parsed.port === String(DB_TUNNEL_PORT);
    return {
        host,
        database: parsed.pathname.replace(/^\//, '') || '(none)',
        isLocal: LOCAL_HOSTS.has(bareHost) && !viaTunnel,
        viaTunnel,
    };
}

/** 대상 한 줄 요약 — 모든 스크립트가 시작할 때 찍는다. */
export function formatTarget(target: DbTarget): string {
    const label = target.isLocal ? 'local' : 'REMOTE';
    const tunnel = target.viaTunnel
        ? ` via tunnel :${DB_TUNNEL_PORT} = PRODUCTION`
        : '';
    return `${target.host}/${target.database} (${label}${tunnel})`;
}

/**
 * 쓰기 전에 부른다. 원격이면 `ALLOW_REMOTE_DB_WRITE=1` 없이는 던진다.
 *
 * @param operation 거부 메시지에 들어갈 작업 이름. 무엇을 막았는지 사람이 알아야 한다.
 */
export function assertRemoteWriteAllowed(
    target: DbTarget,
    operation: string
): void {
    if (target.isLocal) return;
    if (process.env.ALLOW_REMOTE_DB_WRITE === '1') {
        console.warn(
            `[db] ⚠️ 원격 대상에 쓴다: ${formatTarget(target)} — ALLOW_REMOTE_DB_WRITE=1`
        );
        return;
    }
    throw new Error(
        `[db] 거부: '${operation}'은 원격 DB(${formatTarget(target)})에 쓰려 한다.\n` +
            `      원격(운영 포함) 대상이다. 의도한 것이면 ` +
            `ALLOW_REMOTE_DB_WRITE=1 을 명시할 것.\n` +
            `      로컬에 쓰려면 DATABASE_URL을 로컬 Postgres(\`yarn db:dev:up\`, :5435)로 둘 것.`
    );
}

/**
 * `DIRECT_DATABASE_URL || DATABASE_URL`을 읽어 **string으로 좁혀** 돌려준다. 없으면 던진다.
 *
 * 모듈 최상단의 `if (!url) throw`는 함수 선언 안에서 좁혀지지 않아 `url!`가 필요했다.
 * 이 헬퍼는 좁혀진 값을 반환하므로 호출부에 비-null 단언이 남지 않는다.
 * (DIRECT가 우선이다 — `migrate.ts`와 같은 규칙.)
 */
export function requireDatabaseUrl(): string {
    const databaseUrl =
        process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error(
            'DIRECT_DATABASE_URL (or DATABASE_URL) environment variable is required'
        );
    }
    return databaseUrl;
}

/**
 * 쓰기 스크립트의 진입점 한 줄: 대상을 찍고 원격이면 거부한다.
 *
 * `readDatabaseUrl`을 못 쓰는 스크립트(접속 문자열을 모듈 최상단에서 이미 읽었거나,
 * 앱 클라이언트가 `DATABASE_URL`을 직접 읽는 경우)가 쓴다. 호출 위치는 **네트워크·DB
 * 접근보다 앞**이어야 한다 — 거부 전에 FMP 호출이나 LLM 비용이 나가면 가드가 반쪽이다.
 *
 * @param operation 거부 메시지에 들어갈 작업 이름.
 */
export function guardRemoteWrite(
    databaseUrl: string,
    operation: string
): DbTarget {
    const target = describeTarget(databaseUrl);
    console.log(`[db] target: ${formatTarget(target)}`);
    assertRemoteWriteAllowed(target, operation);
    return target;
}

/** 접속 문자열을 읽고 대상을 찍는다. 없으면 던진다. */
export function readDatabaseUrl(): { databaseUrl: string; target: DbTarget } {
    const databaseUrl =
        process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }
    const target = describeTarget(databaseUrl);
    console.log(`[db] target: ${formatTarget(target)}`);
    return { databaseUrl, target };
}
