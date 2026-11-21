import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';

const INFRA = join(process.cwd(), 'infra/aws');

/** 실제 호출처럼 이름만 돌려주는 가짜 aws(값은 절대 싣지 않는다). */
const FAKE_AWS = `#!/usr/bin/env bash
printf '%s' "$FAKE_SSM_JSON"
`;

function run(ssmNames: readonly string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'check-env-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    const infra = join(dir, 'infra');
    const bin = join(dir, 'bin');
    mkdirSync(infra);
    mkdirSync(bin);
    copyFileSync(join(INFRA, 'check-env.sh'), join(infra, 'check-env.sh'));
    copyFileSync(join(INFRA, 'lib.sh'), join(infra, 'lib.sh'));
    writeFileSync(join(infra, '.env'), '');
    writeFileSync(join(bin, 'aws'), FAKE_AWS);
    chmodSync(join(bin, 'aws'), 0o755);
    const gate = join(dir, 'env-gate.txt');
    writeFileSync(gate, 'required REQUIRED_ONE\n');

    const result = spawnSync('bash', [join(infra, 'check-env.sh'), gate], {
        encoding: 'utf8',
        env: {
            NODE_ENV: 'test',
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            FAKE_SSM_JSON: JSON.stringify({
                Parameters: ssmNames.map(name => ({
                    Name: `/siglens/${name}`,
                })),
            }),
        },
    });
    return { status: result.status, out: result.stdout + result.stderr };
}

describe('check-env.sh MIGRATION_GATE warning', () => {
    it('SSM에 MIGRATION_GATE가 있으면 경고하고 통과한다', () => {
        const r = run(['REQUIRED_ONE', 'MIGRATION_GATE']);
        expect(r.status).toBe(0);
        expect(r.out).toContain('WARN: SSM /siglens/MIGRATION_GATE is set');
    });

    it('없으면 경고하지 않는다', () => {
        const r = run(['REQUIRED_ONE']);
        expect(r.status).toBe(0);
        expect(r.out).not.toContain('MIGRATION_GATE');
    });

    it('이름이 비슷한 다른 키는 경고를 켜지 않는다', () => {
        const r = run(['REQUIRED_ONE', 'MIGRATION_GATE_NOTES']);
        expect(r.status).toBe(0);
        expect(r.out).not.toContain('WARN: SSM /siglens/MIGRATION_GATE');
    });
});
