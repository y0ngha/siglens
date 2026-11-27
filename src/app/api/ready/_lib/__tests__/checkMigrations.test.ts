vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: vi.fn() }));

import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_TIMEOUT_MS } from '@/app/api/ready/_lib/checkDependencies';
import { NON_OK_CACHE_MS } from '@/app/api/ready/_lib/checkMigrations';
import { readMigrationJournal } from '@/shared/db/migrations/migrationJournal';

const EXPECTED = readMigrationJournal(path.join(process.cwd(), 'drizzle'));
const ALL_HASHES = EXPECTED.map(m => ({ hash: m.hash }));
const LAST = EXPECTED[EXPECTED.length - 1];
const ALL_BUT_LAST = ALL_HASHES.slice(0, -1);

/** `checkMigrations`의 프로세스 단위 상태(ok 기억, 경고 1회)를 테스트마다 새로 만든다. */
async function load() {
    vi.resetModules();
    const { checkMigrations } =
        await import('@/app/api/ready/_lib/checkMigrations');
    const { tryGetDatabaseClient } = await import('@/shared/db/client');
    // 모듈 팩토리의 vi.fn은 리셋을 넘어 같은 인스턴스라 앞 테스트의 호출 기록을 비운다.
    vi.mocked(tryGetDatabaseClient).mockReset();
    return {
        checkMigrations,
        tryGetDatabaseClient: vi.mocked(tryGetDatabaseClient),
    };
}

function dbClient(sqlImpl: () => Promise<unknown>) {
    const sql = vi.fn(sqlImpl);
    return { client: { db: {}, sql } as never, sql };
}

function logged(spy: ReturnType<typeof vi.spyOn>): string {
    return spy.mock.calls.flat().map(String).join(' ');
}

describe('checkMigrations', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // 기본(enforce) 경로 테스트가 실행 머신의 env에 기대지 않게 비운다.
        vi.stubEnv('MIGRATION_GATE', undefined);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        vi.doUnmock('@/shared/db/migrations/migrationPolicy');
        vi.doUnmock('@/shared/db/migrations/migrationJournal');
    });

    it('모두 적용돼 있으면 200 ok와 기대 개수를 돌려주고 결과를 기억한다', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        const { client, sql } = dbClient(() => Promise.resolve(ALL_HASHES));
        tryGetDatabaseClient.mockReturnValue(client);

        const first = await checkMigrations();
        const second = await checkMigrations();

        expect(first).toEqual({
            httpStatus: 200,
            body: {
                status: 'ok',
                expected: EXPECTED.length,
                postDeployPending: 0,
            },
        });
        expect(second).toEqual(first);
        expect(sql).toHaveBeenCalledTimes(1);
    });

    it('배포 뒤 허용 태그가 대기 중이면 ok이고 개수만 postDeployPending에 담는다', async () => {
        vi.resetModules();
        vi.doMock('@/shared/db/migrations/migrationPolicy', () => ({
            MIGRATION_POLICY: { postDeployTags: [LAST.tag], legacyHashes: {} },
        }));
        const { checkMigrations } =
            await import('@/app/api/ready/_lib/checkMigrations');
        const { tryGetDatabaseClient } = await import('@/shared/db/client');
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const result = await checkMigrations();

        expect(result.body).toEqual({
            status: 'ok',
            expected: EXPECTED.length,
            postDeployPending: 1,
        });
    });

    it('누락이 있으면(enforce) 503이고 본문에는 개수만, 태그는 서버 로그에만 남는다', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const result = await checkMigrations();

        expect(result).toEqual({
            httpStatus: 503,
            body: { status: 'missing', missing: 1 },
        });
        expect(JSON.stringify(result.body)).not.toContain(LAST.tag);
        expect(logged(errorSpy)).toContain(
            `[migrations] missing 1: ${LAST.tag}`
        );
    });

    it('누락 결과는 캐시 시간 안에서는 재사용하고 지나면 다시 조회한다', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const { checkMigrations, tryGetDatabaseClient } = await load();
        const { client, sql } = dbClient(() => Promise.resolve(ALL_BUT_LAST));
        tryGetDatabaseClient.mockReturnValue(client);

        const first = await checkMigrations();
        const cached = await checkMigrations();
        expect(cached).toBe(first);
        expect(sql).toHaveBeenCalledTimes(1);

        vi.setSystemTime(Date.now() + NON_OK_CACHE_MS + 1);
        await checkMigrations();
        expect(sql).toHaveBeenCalledTimes(2);
    });

    it('unknown 결과도 캐시 시간 동안 DB를 다시 부르지 않는다', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        const { client, sql } = dbClient(() =>
            Promise.reject(new Error('down'))
        );
        tryGetDatabaseClient.mockReturnValue(client);

        await checkMigrations();
        const second = await checkMigrations();

        expect(second.body).toEqual({
            status: 'unknown',
            error: 'unreachable',
        });
        expect(sql).toHaveBeenCalledTimes(1);
    });

    it('모드가 바뀌면 다른 모드의 캐시를 쓰지 않는다', async () => {
        vi.stubEnv('MIGRATION_GATE', 'enforce');
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const enforced = await checkMigrations();
        vi.stubEnv('MIGRATION_GATE', 'report');
        const reported = await checkMigrations();

        expect(enforced.httpStatus).toBe(503);
        expect(reported.body).toEqual({ status: 'report', missing: 1 });
    });

    it('저널과 해시는 프로세스당 한 번만 읽는다', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.resetModules();
        const readSpy = vi.fn();
        vi.doMock('@/shared/db/migrations/migrationJournal', async () => {
            const actual = await vi.importActual<
                typeof import('@/shared/db/migrations/migrationJournal')
            >('@/shared/db/migrations/migrationJournal');
            return {
                ...actual,
                readMigrationJournal: (root: string) => {
                    readSpy(root);
                    return actual.readMigrationJournal(root);
                },
            };
        });
        const { checkMigrations } =
            await import('@/app/api/ready/_lib/checkMigrations');
        const { tryGetDatabaseClient } = await import('@/shared/db/client');
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        await checkMigrations();
        vi.setSystemTime(Date.now() + NON_OK_CACHE_MS + 1);
        await checkMigrations();

        expect(readSpy).toHaveBeenCalledTimes(1);
        vi.doUnmock('@/shared/db/migrations/migrationJournal');
    });

    it('MIGRATION_GATE=report이면 누락이 있어도 200 report이고 태그는 경고 로그에 남는다', async () => {
        vi.stubEnv('MIGRATION_GATE', 'report');
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const result = await checkMigrations();

        expect(result).toEqual({
            httpStatus: 200,
            body: { status: 'report', missing: 1 },
        });
        expect(logged(warnSpy)).toContain(
            `[migrations] gate mode report: missing 1: ${LAST.tag}`
        );
    });

    it('MIGRATION_GATE=off이면 DB도 저널도 건드리지 않고 skipped를 돌려준다', async () => {
        vi.stubEnv('MIGRATION_GATE', 'off');
        const { checkMigrations, tryGetDatabaseClient } = await load();

        const result = await checkMigrations();

        expect(result).toEqual({
            httpStatus: 200,
            body: { status: 'skipped' },
        });
        expect(tryGetDatabaseClient).not.toHaveBeenCalled();
    });

    it('모르는 MIGRATION_GATE 값은 enforce처럼 동작하고 경고는 한 번만 남긴다', async () => {
        vi.stubEnv('MIGRATION_GATE', 'whatever');
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const first = await checkMigrations();
        await checkMigrations();

        expect(first.httpStatus).toBe(503);
        expect(first.body.status).toBe('missing');
        const warnings = warnSpy.mock.calls
            .flat()
            .map(String)
            .filter((line: string) => line.includes('unknown MIGRATION_GATE'));
        expect(warnings).toHaveLength(1);
    });

    it('MIGRATION_GATE가 빈 문자열이면 경고 없이 enforce로 본다', async () => {
        vi.stubEnv('MIGRATION_GATE', '');
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.resolve(ALL_BUT_LAST)).client
        );

        const result = await checkMigrations();

        expect(result.body.status).toBe('missing');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('DB 클라이언트가 없으면 unknown/not_configured', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(null);

        expect(await checkMigrations()).toEqual({
            httpStatus: 503,
            body: { status: 'unknown', error: 'not_configured' },
        });
    });

    it('조회가 제한 시간을 넘기면 unknown/timeout', async () => {
        vi.useFakeTimers();
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => new Promise(() => {})).client
        );

        const pending = checkMigrations();
        await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS);

        expect(await pending).toEqual({
            httpStatus: 503,
            body: { status: 'unknown', error: 'timeout' },
        });
    });

    it('저널 테이블이 없으면(42P01) 기대 전체가 누락이다', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() =>
                Promise.reject(Object.assign(new Error('x'), { code: '42P01' }))
            ).client
        );

        expect(await checkMigrations()).toEqual({
            httpStatus: 503,
            body: { status: 'missing', missing: EXPECTED.length },
        });
    });

    it('그 밖의 DB 오류는 unknown/unreachable이고 비밀은 로그에 새지 않는다', async () => {
        const { checkMigrations, tryGetDatabaseClient } = await load();
        const failure = Object.assign(
            new Error('password authentication failed for hunter2-secret'),
            { name: 'PostgresError', code: '28P01' }
        );
        tryGetDatabaseClient.mockReturnValue(
            dbClient(() => Promise.reject(failure)).client
        );

        const result = await checkMigrations();

        expect(result).toEqual({
            httpStatus: 503,
            body: { status: 'unknown', error: 'unreachable' },
        });
        const text = logged(errorSpy);
        expect(text).toContain('[migrations] applied hashes read failed:');
        expect(text).not.toContain('hunter2-secret');
    });

    it('저널을 읽지 못하면 DB를 보기 전에 manifest_unavailable로 닫는다', async () => {
        const emptyDir = mkdtempSync(path.join(tmpdir(), 'no-drizzle-'));
        vi.spyOn(process, 'cwd').mockReturnValue(emptyDir);
        try {
            const { checkMigrations, tryGetDatabaseClient } = await load();

            const result = await checkMigrations();

            expect(result).toEqual({
                httpStatus: 503,
                body: { status: 'manifest_unavailable' },
            });
            expect(tryGetDatabaseClient).not.toHaveBeenCalled();
            expect(logged(errorSpy)).toContain(
                '[migrations] manifest unavailable:'
            );
        } finally {
            rmSync(emptyDir, { recursive: true, force: true });
        }
    });
});
