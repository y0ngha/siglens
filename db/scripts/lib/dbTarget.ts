/**
 * DB 스크립트의 **대상 확인 + 원격 쓰기 가드**.
 *
 * `yarn db:*` 스크립트는 전부 `dotenv -e .env.local`로 묶여 있고, 그 파일은
 * **운영 Neon 인스턴스를 가리킨다.** 즉 `yarn db:backfill:content-locale --apply`
 * 한 번이면 운영 데이터에 쓴다 — 로컬에 쓰려던 사람이 플래그 하나 잘못 붙이면
 * 되돌릴 수 없는 작업이 나간다.
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

export interface DbTarget {
    readonly host: string;
    readonly database: string;
    readonly isLocal: boolean;
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
        return { host: '(unparseable)', database: '(unknown)', isLocal: false };
    }
    const host = parsed.hostname;
    return {
        host,
        database: parsed.pathname.replace(/^\//, '') || '(none)',
        isLocal: LOCAL_HOSTS.has(host),
    };
}

/** 대상 한 줄 요약 — 모든 스크립트가 시작할 때 찍는다. */
export function formatTarget(target: DbTarget): string {
    return `${target.host}/${target.database} (${target.isLocal ? 'local' : 'REMOTE'})`;
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
            `      \`.env.local\`은 운영 인스턴스를 가리킨다. 의도한 것이면 ` +
            `ALLOW_REMOTE_DB_WRITE=1 을 명시할 것.\n` +
            `      로컬에 쓰려면 DATABASE_URL을 로컬 Postgres로 덮어쓸 것.`
    );
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
