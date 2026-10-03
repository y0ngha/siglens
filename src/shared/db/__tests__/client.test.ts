vi.mock('postgres', () => ({
    default: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
    drizzle: vi.fn(() => ({})),
}));

vi.mock('@/shared/db/config', () => ({
    readDatabaseConfig: vi.fn(() => ({ databaseUrl: 'postgres://test' })),
    tryReadDatabaseConfig: vi.fn(() => ({ databaseUrl: 'postgres://test' })),
}));

vi.mock('@/shared/db/schema', () => ({}));

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readDatabaseConfig, tryReadDatabaseConfig } from '@/shared/db/config';
import {
    DB_POOL_MAX,
    createDatabaseClient,
    endDatabaseClient,
    getDatabaseClient,
    isLocalDbHost,
    isPooledConnectionUrl,
    resetDatabaseClientForTests,
    resolvePrepare,
    resolveSslOption,
    stripLibpqOnlyParams,
    tryGetDatabaseClient,
} from '@/shared/db/client';
import { noStoreQueryLogger } from '@/shared/db/noStoreQueryLogger';
import { __resetOfflineBuildWarningsForTests } from '@/shared/api/offlineBuild';

const NEON_DIRECT_URL =
    'postgresql://u:p@ep-cool-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const NEON_POOLER_URL =
    'postgresql://u:p@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const NEON_CONSOLE_URL = `${NEON_POOLER_URL}&channel_binding=require`;

/** `postgres(url, options)` 호출에 넘어간 options를 꺼낸다. */
function lastPostgresOptions(): Record<string, unknown> {
    const call = vi.mocked(postgres).mock.calls.at(-1);
    return (call?.[1] ?? {}) as Record<string, unknown>;
}

describe('isPooledConnectionUrl', () => {
    it('Neon pooler 호스트(-pooler.)는 true다', () => {
        expect(isPooledConnectionUrl(NEON_POOLER_URL)).toBe(true);
    });

    it.each([
        ['Neon direct 호스트', NEON_DIRECT_URL],
        [
            'RDS 호스트',
            'postgresql://u:p@db.abc.ap-northeast-2.rds.amazonaws.com:5432/siglens?sslmode=verify-full',
        ],
        ['로컬', 'postgres://siglens:siglens@localhost:5434/siglens_cachetest'],
    ])('%s는 false다', (_label, url) => {
        expect(isPooledConnectionUrl(url)).toBe(false);
    });

    it('파싱할 수 없는 URL은 false다', () => {
        expect(isPooledConnectionUrl('not a url')).toBe(false);
    });

    it('호스트가 아니라 비밀번호·DB 이름에 -pooler.가 있어도 false다', () => {
        expect(
            isPooledConnectionUrl(
                'postgres://u:x-pooler.y@localhost/db-pooler.x'
            )
        ).toBe(false);
    });
});

describe('isLocalDbHost', () => {
    it.each([
        'localhost',
        'LOCALHOST',
        '127.0.0.1',
        '::1',
        '[::1]',
        'postgres',
        'host.docker.internal',
    ])('%s는 로컬이다', host => {
        expect(isLocalDbHost(host)).toBe(true);
    });

    it.each([
        'ep-cool-123-pooler.ap-southeast-1.aws.neon.tech',
        'db.abc.ap-northeast-2.rds.amazonaws.com',
        'localhost.evil.example',
        '10.0.0.5',
    ])('%s는 로컬이 아니다', host => {
        expect(isLocalDbHost(host)).toBe(false);
    });
});

describe('resolveSslOption', () => {
    it.each(['require', 'prefer', 'allow'])(
        '원격 호스트의 sslmode=%s는 verify-full로 끌어올린다',
        mode => {
            expect(
                resolveSslOption(
                    `postgresql://u:p@ep-x-pooler.aws.neon.tech/neondb?sslmode=${mode}`
                )
            ).toBe('verify-full');
        }
    );

    it('Neon 콘솔 URL(sslmode=require&channel_binding=require)도 verify-full이다', () => {
        expect(resolveSslOption(NEON_POOLER_URL)).toBe('verify-full');
    });

    it.each([
        'localhost',
        '127.0.0.1',
        '[::1]',
        'postgres',
        'host.docker.internal',
    ])('로컬 호스트(%s)는 URL이 말하는 대로 둔다', host => {
        expect(
            resolveSslOption(`postgres://u:p@${host}:5432/db?sslmode=require`)
        ).toBeUndefined();
    });

    it.each(['verify-full', 'verify-ca', 'disable'])(
        '원격이어도 sslmode=%s는 건드리지 않는다(postgres-js가 직접 처리)',
        mode => {
            expect(
                resolveSslOption(
                    `postgres://u:p@db.example.com/db?sslmode=${mode}`
                )
            ).toBeUndefined();
        }
    );

    it('원격에 sslmode가 없으면 건드리지 않는다', () => {
        expect(
            resolveSslOption('postgres://u:p@db.example.com/db')
        ).toBeUndefined();
    });

    it('sslmode 없이 sslrootcert=system만 있으면 verify-full로 옮겨 준다', () => {
        expect(
            resolveSslOption(
                'postgres://u:p@db.example.com/db?sslrootcert=system'
            )
        ).toBe('verify-full');
    });

    it('파싱할 수 없는 URL은 undefined다', () => {
        expect(resolveSslOption('not a url')).toBeUndefined();
    });
});

describe('resolvePrepare', () => {
    it('기본값: pooler 호스트는 false, 그 외는 true', () => {
        expect(resolvePrepare(NEON_POOLER_URL, undefined)).toBe(false);
        expect(resolvePrepare(NEON_DIRECT_URL, undefined)).toBe(true);
    });

    it('DATABASE_PREPARE=true|false가 기본 규칙을 덮어쓴다', () => {
        expect(resolvePrepare(NEON_POOLER_URL, 'true')).toBe(true);
        expect(resolvePrepare(NEON_DIRECT_URL, 'false')).toBe(false);
    });

    it('알 수 없는 override 값은 무시하고 기본 규칙을 쓴다', () => {
        expect(resolvePrepare(NEON_POOLER_URL, 'yes')).toBe(false);
        expect(resolvePrepare(NEON_DIRECT_URL, '')).toBe(true);
    });

    it('override를 생략하면 process.env.DATABASE_PREPARE를 읽는다', () => {
        vi.stubEnv('DATABASE_PREPARE', 'false');
        expect(resolvePrepare(NEON_DIRECT_URL)).toBe(false);
        vi.unstubAllEnvs();
    });
});

describe('stripLibpqOnlyParams', () => {
    it('channel_binding을 떼고 sslmode 등 나머지는 유지한다', () => {
        const stripped = stripLibpqOnlyParams(
            'postgresql://u:p%40ss@host.neon.tech/neondb?sslmode=require&channel_binding=require'
        );
        const url = new URL(stripped);
        expect(url.searchParams.has('channel_binding')).toBe(false);
        expect(url.searchParams.get('sslmode')).toBe('require');
        expect(url.password).toBe('p%40ss');
        expect(url.hostname).toBe('host.neon.tech');
    });

    it.each([
        'channel_binding',
        'sslrootcert',
        'sslcert',
        'sslkey',
        'sslcrl',
        'sslpassword',
        'gssencmode',
    ])('%s를 뗀다', key => {
        const stripped = stripLibpqOnlyParams(
            `postgresql://u:p@host.example.com/db?sslmode=verify-full&${key}=x`
        );
        const url = new URL(stripped);
        expect(url.searchParams.has(key)).toBe(false);
        expect(url.searchParams.get('sslmode')).toBe('verify-full');
    });

    it('postgres-js가 이해하는 파라미터는 건드리지 않는다', () => {
        const input =
            'postgresql://u:p@host.example.com/db?sslmode=require&target_session_attrs=read-write&application_name=siglens&connect_timeout=5';
        expect(stripLibpqOnlyParams(input)).toBe(input);
    });

    it('뗄 게 없으면 입력을 그대로 돌려준다', () => {
        expect(stripLibpqOnlyParams(NEON_DIRECT_URL)).toBe(NEON_DIRECT_URL);
    });

    it('파싱할 수 없는 URL은 그대로 돌려준다', () => {
        expect(stripLibpqOnlyParams('not a url')).toBe('not a url');
    });
});

describe('createDatabaseClient', () => {
    beforeEach(() => {
        vi.mocked(postgres).mockClear();
        vi.mocked(drizzle).mockClear();
        vi.mocked(postgres).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('postgres와 drizzle을 호출하고 db, sql 프로퍼티를 가진 객체를 반환한다', () => {
        const mockSql = vi.fn();
        const mockDb = { tables: true };
        vi.mocked(postgres).mockReturnValue(mockSql as never);
        vi.mocked(drizzle).mockReturnValue(mockDb as never);

        const client = createDatabaseClient({
            databaseUrl: 'postgres://test-url',
        });

        expect(postgres).toHaveBeenCalledWith(
            'postgres://test-url',
            expect.any(Object)
        );
        expect(drizzle).toHaveBeenCalledWith(mockSql, expect.any(Object));
        expect(client).toHaveProperty('db', mockDb);
        expect(client).toHaveProperty('sql', mockSql);
    });

    it('풀 옵션을 고정값으로 넘긴다', () => {
        createDatabaseClient({ databaseUrl: NEON_DIRECT_URL });

        expect(DB_POOL_MAX).toBe(10);
        expect(lastPostgresOptions()).toMatchObject({
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            max_lifetime: 60 * 30,
        });
    });

    it('원격 호스트의 sslmode=require는 ssl: verify-full로 올려 넘긴다', () => {
        createDatabaseClient({ databaseUrl: NEON_DIRECT_URL });

        expect(lastPostgresOptions().ssl).toBe('verify-full');
    });

    it('Neon 콘솔 URL(channel_binding 포함)도 verify-full이고 channel_binding은 뗀다', () => {
        createDatabaseClient({ databaseUrl: NEON_CONSOLE_URL });

        expect(lastPostgresOptions().ssl).toBe('verify-full');
        expect(
            String(vi.mocked(postgres).mock.calls.at(-1)?.[0])
        ).not.toContain('channel_binding');
    });

    it('로컬 호스트는 ssl 옵션을 지정하지 않는다(로컬 Docker Postgres는 TLS가 없다)', () => {
        createDatabaseClient({
            databaseUrl:
                'postgres://siglens:siglens@localhost:5434/siglens_cachetest',
        });

        expect(lastPostgresOptions()).not.toHaveProperty('ssl');
    });

    it('DATABASE_PREPARE override를 반영한다', () => {
        vi.stubEnv('DATABASE_PREPARE', 'true');
        createDatabaseClient({ databaseUrl: NEON_POOLER_URL });
        expect(lastPostgresOptions().prepare).toBe(true);
        vi.unstubAllEnvs();
    });

    it('Neon pooler 호스트면 prepare를 끈다', () => {
        createDatabaseClient({ databaseUrl: NEON_POOLER_URL });

        expect(lastPostgresOptions().prepare).toBe(false);
    });

    it.each([
        ['Neon direct', NEON_DIRECT_URL],
        ['로컬', 'postgres://siglens:siglens@localhost:5434/siglens_cachetest'],
    ])('%s 호스트면 prepare를 켠다', (_label, url) => {
        createDatabaseClient({ databaseUrl: url });

        expect(lastPostgresOptions().prepare).toBe(true);
    });

    it('drizzle에 schema와 noStore 로거를 꽂는다', () => {
        createDatabaseClient({ databaseUrl: NEON_DIRECT_URL });

        expect(drizzle).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ logger: noStoreQueryLogger })
        );
        expect(vi.mocked(drizzle).mock.calls.at(-1)?.[1]).toHaveProperty(
            'schema'
        );
    });
});

describe('getDatabaseClient', () => {
    beforeEach(() => {
        resetDatabaseClientForTests();
        vi.mocked(postgres).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('DatabaseClient를 반환한다', () => {
        const client = getDatabaseClient();
        expect(client).toHaveProperty('db');
        expect(client).toHaveProperty('sql');
    });

    it('두 번 호출해도 같은 캐시된 인스턴스를 반환한다', () => {
        const first = getDatabaseClient();
        vi.mocked(readDatabaseConfig).mockClear();
        const second = getDatabaseClient();
        expect(first).toBe(second);
        // 캐시 히트이므로 readDatabaseConfig가 다시 호출되지 않아야 한다.
        expect(readDatabaseConfig).not.toHaveBeenCalled();
    });

    it('resetDatabaseClientForTests 후에는 새 인스턴스를 생성한다', () => {
        const first = getDatabaseClient();
        resetDatabaseClientForTests();
        const second = getDatabaseClient();
        expect(first).not.toBe(second);
    });
});

describe('클라이언트 캐시와 풀 종료', () => {
    const CACHE_KEY = Symbol.for('siglens.databaseClient');

    beforeEach(() => {
        resetDatabaseClientForTests();
        vi.mocked(postgres).mockClear();
    });

    it('캐시는 globalThis 심볼 키에 저장돼 모듈이 다시 평가돼도 풀을 새로 열지 않는다', () => {
        const client = getDatabaseClient();
        expect(
            (globalThis as unknown as Record<symbol, unknown>)[CACHE_KEY]
        ).toBe(client);

        vi.mocked(postgres).mockClear();
        // 다른 모듈 인스턴스가 같은 전역 슬롯을 읽는 상황을 흉내 낸다.
        expect(getDatabaseClient()).toBe(client);
        expect(postgres).not.toHaveBeenCalled();
    });

    it('endDatabaseClient는 풀을 닫고 캐시를 비운다', async () => {
        const end = vi.fn().mockResolvedValue(undefined);
        vi.mocked(postgres).mockReturnValue({ end } as never);
        const first = getDatabaseClient();

        await endDatabaseClient(3);

        expect(end).toHaveBeenCalledWith({ timeout: 3 });
        expect(
            (globalThis as unknown as Record<symbol, unknown>)[CACHE_KEY]
        ).toBeNull();
        // 이후 호출은 닫힌 풀이 아니라 새 클라이언트를 만든다.
        expect(getDatabaseClient()).not.toBe(first);
    });

    it('endDatabaseClient는 기본 timeout 5초를 쓰고, 캐시가 없으면 no-op이다', async () => {
        await expect(endDatabaseClient()).resolves.toBeUndefined();

        const end = vi.fn().mockResolvedValue(undefined);
        vi.mocked(postgres).mockReturnValue({ end } as never);
        getDatabaseClient();
        await endDatabaseClient();
        expect(end).toHaveBeenCalledWith({ timeout: 5 });
    });

    it('풀 종료가 실패해도 던지지 않고 경고만 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(postgres).mockReturnValue({
            end: vi.fn().mockRejectedValue(new Error('end failed')),
        } as never);
        getDatabaseClient();

        await expect(endDatabaseClient()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('tryGetDatabaseClient', () => {
    beforeEach(() => {
        resetDatabaseClientForTests();
        vi.mocked(postgres).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('config가 존재하면 DatabaseClient를 반환한다', () => {
        vi.mocked(tryReadDatabaseConfig).mockReturnValue({
            databaseUrl: 'postgres://test',
        });
        const client = tryGetDatabaseClient();
        expect(client).not.toBeNull();
        expect(client).toHaveProperty('db');
        expect(client).toHaveProperty('sql');
    });

    it('config가 null이면 null을 반환한다', () => {
        vi.mocked(tryReadDatabaseConfig).mockReturnValue(null);
        const client = tryGetDatabaseClient();
        expect(client).toBeNull();
    });
});

describe('offline build 가드', () => {
    beforeEach(() => {
        resetDatabaseClientForTests();
        __resetOfflineBuildWarningsForTests();
        vi.mocked(postgres).mockClear();
        vi.mocked(readDatabaseConfig).mockClear();
        vi.mocked(tryReadDatabaseConfig).mockReturnValue({
            databaseUrl: 'postgres://test',
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('getDatabaseClient는 postgres()를 호출하지 않고 [offline-build] 에러를 던진다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        expect(() => getDatabaseClient()).toThrow('[offline-build]');
        expect(postgres).not.toHaveBeenCalled();
        expect(readDatabaseConfig).not.toHaveBeenCalled();
    });

    it('tryGetDatabaseClient는 postgres()를 호출하지 않고 null을 반환한다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        expect(tryGetDatabaseClient()).toBeNull();
        expect(postgres).not.toHaveBeenCalled();
    });

    it('SIGLENS_OFFLINE_BUILD가 미설정이면 평소대로 동작한다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        expect(() => getDatabaseClient()).not.toThrow();
        expect(postgres).toHaveBeenCalled();
    });
});
