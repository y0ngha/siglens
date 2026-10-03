import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * 소스를 grep하는 테스트는 가드가 *있다*만 보고, 가드가 **네트워크·DB 접근보다
 * 앞에서 실제로 막는지**는 못 본다. 그래서 스크립트를 진짜로 실행한다 — 원격
 * URL을 주고 `ALLOW_REMOTE_DB_WRITE` 없이 돌리면, FMP·LLM·DB에 닿기 전에 거부로
 * 죽어야 한다. (가드를 지우면 이 테스트는 `invalid` 호스트 접속 오류/키 오류 등
 * 다른 이유로 죽거나 거부 문구가 없어 실패한다.)
 *
 * 환경은 처음부터 새로 만든다 — `.env*`나 호스트 셸의 DB 접속 문자열이 새어
 * 들어가면 이 테스트가 진짜 DB를 건드릴 수 있다. 호스트 `invalid`는 RFC 2606상
 * 해석되지 않는 TLD라, 가드가 뚫려도 아무 데도 닿지 않는다.
 */
const REMOTE_URL = 'postgres://u:p@db.guard-test.invalid:5432/prod';

interface Case {
    readonly file: string;
    readonly operation: string;
}

/**
 * `src/shared/db/schema.ts` 등이 `server-only`를 import하므로 tsx로 직접 돌리려면
 * react-server 조건이 필요하다(package.json의 db:seed:terms가 쓰는 값). 이 조건이
 * 없으면 스크립트가 가드에 닿기 전에 import 단계에서 죽는다.
 */
const NODE_OPTIONS = '--conditions=react-server';

const CASES: readonly Case[] = [
    { file: 'scripts/seed-crypto-assets.ts', operation: 'seed:crypto' },
    { file: 'scripts/seed-kr-listed-names.ts', operation: 'seed:kr-names' },
    {
        file: 'scripts/seed-crypto-korean-names.ts',
        operation: 'seed:crypto-korean',
    },
    {
        file: 'scripts/backfillEconomicCalendar.ts',
        operation: 'backfill:calendar',
    },
    {
        file: 'scripts/seedEconomicEventAnalysis.ts',
        operation: 'seed:calendar-analysis',
    },
    { file: 'db/scripts/seedTerms.ts', operation: 'seed:terms' },
];

describe('쓰기 스크립트는 원격 대상이면 외부 접근 전에 거부한다', () => {
    it.each(CASES)(
        '$file',
        ({ file, operation }) => {
            const result = spawnSync(
                join(process.cwd(), 'node_modules/.bin/tsx'),
                [file],
                {
                    cwd: process.cwd(),
                    encoding: 'utf8',
                    timeout: 90_000,
                    env: {
                        PATH: process.env.PATH ?? '',
                        HOME: process.env.HOME ?? '',
                        // Next 타입이 ProcessEnv.NODE_ENV를 필수로 요구한다.
                        NODE_ENV: 'development',
                        DATABASE_URL: REMOTE_URL,
                        DIRECT_DATABASE_URL: REMOTE_URL,
                        // 키 검증이 가드보다 앞서면 거부 대신 키 오류로 죽는다.
                        FMP_API_KEY: 'dummy',
                        DATA_GO_KR_SERVICE_KEY: 'dummy',
                        GEMINI_API_KEY: 'dummy',
                        NODE_OPTIONS,
                    },
                }
            );
            const output = `${result.stdout}\n${result.stderr}`;
            expect(output).toContain(`거부: '${operation}'`);
            expect(result.status).not.toBe(0);
        },
        120_000
    );
});
