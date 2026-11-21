import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 점검 CLI를 실제로 실행한다. 호스트 `invalid`는 RFC 2606상 해석되지 않으므로 어디에도 닿지
 * 않는다. 환경은 새로 만든다(호스트 셸의 DB 접속 문자열이 새어 들어가면 진짜 DB를 볼 수 있다).
 */
const SECRET = 'sup3r-secret-pw';
const URL_WITH_SECRET = `postgres://app:${SECRET}@db.check-test.invalid:5432/prod`;

function runCli(env: Readonly<Record<string, string>>) {
    const result = spawnSync(
        join(process.cwd(), 'node_modules/.bin/tsx'),
        ['db/scripts/checkMigrations.ts'],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 90_000,
            env: {
                PATH: process.env.PATH ?? '',
                HOME: process.env.HOME ?? '',
                NODE_ENV: 'development',
                ...env,
            },
        }
    );
    return { ...result, combined: `${result.stdout}\n${result.stderr}` };
}

describe('db:check:migrations CLI', () => {
    it('exits 1 with a clear message when no database URL is set', () => {
        const result = runCli({});
        expect(result.status).toBe(1);
        expect(result.combined).toContain('[check-migrations] failed');
    }, 120_000);

    it('prints the target, fails with exit 1 on an unreachable DB, and leaks no secret', () => {
        const result = runCli({ DATABASE_URL: URL_WITH_SECRET });
        expect(result.status).toBe(1);
        expect(result.combined).toContain(
            '[check-migrations] target: db.check-test.invalid/prod (REMOTE)'
        );
        expect(result.combined).not.toContain(SECRET);
    }, 120_000);
});
