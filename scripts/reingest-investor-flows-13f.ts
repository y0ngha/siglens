import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/shared/db/schema';
import { Drizzle13fRepository } from '../src/entities/investor-flows/api/investorFlows13fRepository';
import {
    guardRemoteWrite,
    requireDatabaseUrl,
} from '../db/scripts/lib/dbTarget';
import { prepareReingest } from './lib/reingestInvestorFlows13f';

/**
 * 늦게 매핑된 CUSIP을 위한 13F 재수집 준비 — `yarn investor-flows:reingest-13f [--dry-run]`.
 *
 * 일일 커서 창(200일) 안의 `sec_13f_filings` 행을 지워 sec-13f가 그 제출들을 새 유니버스로 다시 읽게 한다. 이유·부작용·비용은
 * `scripts/lib/reingestInvestorFlows13f.ts` 머리말과 `docs/reference/CRON.md`. **쓰기 스크립트**라 DB-4대로 원격 대상이면
 * 거부한다(`guardRemoteWrite`; 운영에는 `ALLOW_REMOTE_DB_WRITE=1`). `--dry-run`은 쓰지 않고 규모와 비용 추정만 찍는다.
 * sec-13f 실행 **사이**에 돌릴 것(진행 중인 실행과 겹치면 방금 지운 accession을 그 실행이 다시 반영할 수 있다 — 해롭지는
 * 않지만 지운 효과가 줄어든다).
 */
const dryRun = process.argv.includes('--dry-run');
const databaseUrl = requireDatabaseUrl();

async function run(): Promise<void> {
    if (dryRun) console.log('[db] --dry-run: no writes');
    else guardRemoteWrite(databaseUrl, 'investor-flows:reingest-13f');

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client, { schema });
        const repo = new Drizzle13fRepository(db);
        const result = await prepareReingest(
            {
                getState: key => repo.getState(key),
                countLedgerSince: sinceDate => repo.countLedgerSince(sinceDate),
                deleteLedgerSince: sinceDate =>
                    repo.deleteLedgerSince(sinceDate),
                log: message => console.log(message),
            },
            { today: new Date().toISOString().slice(0, 10), dryRun }
        );
        console.log(JSON.stringify(result));
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('reingest-13f failed:', error);
    process.exit(1);
});
