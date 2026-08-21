import postgres from 'postgres';
import { readFileSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import {
    assertRemoteWriteAllowed,
    describeTarget,
    formatTarget,
} from './lib/dbTarget';

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
}

/**
 * **대상 확인 + 원격 쓰기 가드.**
 *
 * 이 스크립트는 `dotenv -e .env.local`로 실행되고, 그 파일은 운영 Neon
 * 인스턴스를 가리킨다. 즉 `yarn db:migrate`는 기본값이 **운영 스키마 변경**이다.
 * 마이그레이션은 되돌리기 어렵고(`DROP INDEX` 포함), 로컬에 적용하려던 사람이
 * 그대로 치면 운영이 바뀐다.
 *
 * 운영에 정말 적용해야 하면 `ALLOW_REMOTE_DB_WRITE=1`을 명시한다 — 실수로 칠 수
 * 있는 값이 아니다. 배포 파이프라인은 이 스크립트를 부르지 않으므로(수동 운영)
 * 이 가드가 자동 배포를 막지 않는다.
 */
const target = describeTarget(databaseUrl);
console.log(`[migrate] target: ${formatTarget(target)}`);
assertRemoteWriteAllowed(target, 'migrate');

// "already exists" error codes from PostgreSQL
const ALREADY_EXISTS_CODES = new Set(['42P07', '42710', '42P16']);

interface JournalEntry {
    idx: number;
    tag: string;
    when: number;
}

/**
 * `--until <tag>`: 그 태그까지만 적용하고 멈춘다.
 *
 * expand/contract 마이그레이션은 **사이에 코드 배포가 끼어야** 한다. 0029(컬럼
 * 추가)와 0030(구 인덱스 제거)이 한 번에 적용되면, 스위치가 아직 꺼진
 * 인스턴스의 프리웜이 `ON CONFLICT (symbol, tab)`으로 쓰다가 42P10으로 죽는다.
 *
 * 예전에는 0030을 **저널에서 빼서** 막았는데, 그러면 `drizzle-kit`의 스냅샷
 * 체인이 끊겨 `db:generate`가 매번 같은 DDL을 다시 뱉는다. 저널에 두고 여기서
 * 멈추는 쪽이 옳다 — 스냅샷도 맞고, 적용 시점도 통제된다.
 */
function parseUntil(argv: readonly string[]): string | null {
    const i = argv.indexOf('--until');
    if (i === -1) return null;
    const tag = argv[i + 1];
    if (tag === undefined || tag.startsWith('--')) {
        throw new Error('[migrate] --until 뒤에 마이그레이션 태그가 필요하다');
    }
    return tag;
}

async function runMigrations(): Promise<void> {
    const until = parseUntil(process.argv.slice(2));
    const sql = postgres(databaseUrl!, { max: 1 });
    const drizzleRoot = path.resolve(__dirname, '../../drizzle');

    const journal: { entries: JournalEntry[] } = JSON.parse(
        readFileSync(path.join(drizzleRoot, 'meta/_journal.json'), 'utf-8')
    );

    if (until !== null && !journal.entries.some(e => e.tag === until)) {
        await sql.end();
        // 오타를 조용히 "전부 적용"으로 흘리면 --until의 의미가 없다.
        throw new Error(`[migrate] --until ${until}: 저널에 없는 태그다`);
    }

    const applied = await sql<{ hash: string }[]>`
        SELECT hash FROM drizzle.__drizzle_migrations
    `;
    const appliedHashes = new Set(applied.map(r => r.hash));

    for (const entry of journal.entries) {
        const migrationSql = readFileSync(
            path.join(drizzleRoot, `${entry.tag}.sql`),
            'utf-8'
        );
        const hash = crypto
            .createHash('sha256')
            .update(migrationSql)
            .digest('hex');

        if (appliedHashes.has(hash)) {
            console.log(`skip (already applied): ${entry.tag}`);
            // `continue`가 아니라 여기서도 멈춤 판정을 한다 — 이미 적용된
            // 마이그레이션을 건너뛰며 `--until` 경계를 넘어가면, 두 번째
            // 실행에서 조용히 그 다음 것까지 적용된다.
            if (entry.tag === until) {
                console.log(`[migrate] --until ${until}: 여기서 멈춘다`);
                break;
            }
            continue;
        }

        const statements = migrationSql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        let allAlreadyExisted = true;

        for (const statement of statements) {
            try {
                await sql.unsafe(statement);
                allAlreadyExisted = false;
            } catch (err: unknown) {
                const code =
                    (err as { code?: string })?.code ??
                    (err as { cause?: { code?: string } })?.cause?.code;
                if (!code || !ALREADY_EXISTS_CODES.has(code)) {
                    await sql.end();
                    throw err;
                }
            }
        }

        await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${entry.when})
            ON CONFLICT DO NOTHING
        `;

        const label = allAlreadyExisted ? 'baseline' : 'applied';
        console.log(`${label}: ${entry.tag}`);

        if (entry.tag === until) {
            console.log(`[migrate] --until ${until}: 여기서 멈춘다`);
            break;
        }
    }

    await sql.end();
    console.log('Migrations complete');
}

runMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
