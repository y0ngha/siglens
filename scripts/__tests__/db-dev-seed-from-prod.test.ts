import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DB_TUNNEL_PORT } from '../../db/scripts/lib/dbTarget';

const root = process.cwd();
const SCRIPT_PATH = join(root, 'scripts/db-dev-seed-from-prod.sh');
const script = readFileSync(SCRIPT_PATH, 'utf8');
const schema = readFileSync(join(root, 'src/shared/db/schema.ts'), 'utf8');

/**
 * 주석 줄을 뺀 실제 코드. 안전장치 문자열은 상단 설명 주석에도 적혀 있어서,
 * 원문에서 `toContain`을 하면 코드가 지워져도 통과한다(공회전).
 */
const code = script
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n');

/**
 * 개인정보·계정 종속 테이블의 기대 목록. 스크립트의 제외 목록과 **독립적으로**
 * 적어 둔다 — FK 파생 검사만으로는 FK가 없는 개인정보 테이블(inquiries,
 * visitor_days)이 빠져도 모른다.
 */
const EXPECTED_PII_TABLES = [
    'users',
    'sessions',
    'oauth_accounts',
    'user_api_keys',
    'portfolio_holdings',
    'email_report_subscriptions',
    'agreements',
    'inquiries',
    'visitor_days',
    'shared_analyses',
    'chat_conversations',
    'chat_messages',
] as const;

function excludedTables(): string[] {
    const body = /EXCLUDED_TABLES=\(([\s\S]*?)\n\)/.exec(code)?.[1] ?? '';
    return body
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
}

/** schema.ts에서 `<parent>.id`를 FK로 참조하는 테이블. */
function tablesReferencing(parent: string): string[] {
    const blocks = schema.split(/\nexport const /).slice(1);
    return blocks.flatMap(block => {
        const name = /pgTable\(\s*'([a-z_]+)'/.exec(block)?.[1];
        if (name === undefined) return [];
        return block.includes(`references(() => ${parent}.id`) ? [name] : [];
    });
}

describe('db-dev-seed-from-prod.sh', () => {
    it('기대한 개인정보 테이블을 모두 제외한다', () => {
        const excluded = excludedTables();
        // 파서가 공회전하지 않는지 — 목록을 실제로 읽어야 한다.
        expect(excluded.length).toBeGreaterThan(0);
        for (const table of EXPECTED_PII_TABLES) {
            expect(excluded).toContain(table);
        }
    });

    it('기대 목록의 테이블이 모두 스키마에 실재한다 (오타 방지)', () => {
        for (const table of [...EXPECTED_PII_TABLES, ...excludedTables()]) {
            expect(schema).toMatch(new RegExp(`pgTable\\(\\s*'${table}'`));
        }
    });

    it('users를 FK로 참조하는 모든 테이블의 행을 제외한다 (새 테이블 대비)', () => {
        const excluded = excludedTables();
        const referencing = tablesReferencing('users');
        expect(referencing.length).toBeGreaterThan(3);
        for (const table of referencing) {
            expect(excluded).toContain(table);
        }
    });

    it('대화 메시지(conversation 소속)도 제외한다', () => {
        const excluded = excludedTables();
        const referencing = tablesReferencing('chatConversations');
        expect(referencing.length).toBeGreaterThan(0);
        for (const table of referencing) {
            expect(excluded).toContain(table);
        }
    });

    it('원본 포트는 dbTarget의 터널 포트와 같다', () => {
        expect(code).toContain(`readonly TUNNEL_PORT=${DB_TUNNEL_PORT}`);
    });

    it('대상은 5435로 고정이고 DEV_DB_PORT를 읽지 않는다', () => {
        expect(code).toContain('readonly DEV_PORT=5435');
        expect(code).not.toContain('DEV_DB_PORT');
    });

    /** 원본(운영) 연결에 읽기 전용 옵션이 실제로 실려 나가야 한다. */
    it('원본 pg_dump 컨테이너에 읽기 전용 PGOPTIONS를 싣는다', () => {
        expect(code).toMatch(
            /^\s*PGOPTIONS='-c default_transaction_read_only=on'/m
        );
        expect(code).toMatch(/docker run[^\n]*-e PGOPTIONS/);
    });

    /**
     * Linux는 host.docker.internal이 없다. uname을 가짜로 바꿔 끼워서, 다른
     * 검사(URL·docker)보다 먼저 플랫폼에서 거부하는지 본다.
     */
    it('Linux에서는 Docker 접근 전에 거부한다', () => {
        const dir = mkdtempSync(join(tmpdir(), 'seed-uname-'));
        try {
            const fakeUname = join(dir, 'uname');
            writeFileSync(fakeUname, '#!/bin/sh\necho Linux\n');
            chmodSync(fakeUname, 0o755);
            const result = spawnSync('bash', [SCRIPT_PATH, '--yes'], {
                encoding: 'utf8',
                env: {
                    PATH: `${dir}:${process.env.PATH ?? ''}`,
                    SOURCE_DATABASE_URL: `postgres://u:p@localhost:${DB_TUNNEL_PORT}/db`,
                },
            });
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain('Docker Desktop');
            expect(result.stderr).toContain('Linux');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
