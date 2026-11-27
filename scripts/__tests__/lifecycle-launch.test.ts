import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    extractHeredoc,
    readUserData,
} from '../../src/__tests__/guards/support/userDataScripts';

/** IMDS(토큰 PUT, instance-id GET)와 터널 `/ready`만 흉내 내는 가짜 curl. */
const FAKE_CURL = `#!/usr/bin/env bash
case "$*" in
    *"-X PUT"*) printf 'tok' ;;
    *meta-data/instance-id*)
        [ "$FAKE_IMDS_FAIL" = '1' ] && exit 22
        printf 'i-0abc' ;;
    *:2000/ready*) exit 0 ;;
esac
`;

/** 호출 인자를 한 줄씩 기록하는 가짜 aws. 종료 코드는 FAKE_AWS_EXIT. */
const FAKE_AWS = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_AWS_LOG"
exit "\${FAKE_AWS_EXIT:-0}"
`;

const dirs: string[] = [];

interface RunOptions {
    failedMarker?: boolean;
    awsExit?: number;
    imdsFail?: boolean;
}

function run({ failedMarker, awsExit = 0, imdsFail }: RunOptions) {
    const dir = mkdtempSync(join(tmpdir(), 'lifecycle-launch-'));
    dirs.push(dir);
    const bin = join(dir, 'bin');
    const runDir = join(dir, 'run');
    mkdirSync(bin);
    mkdirSync(runDir);
    writeFileSync(join(bin, 'curl'), FAKE_CURL);
    writeFileSync(join(bin, 'aws'), FAKE_AWS);
    chmodSync(join(bin, 'curl'), 0o755);
    chmodSync(join(bin, 'aws'), 0o755);
    const script = join(dir, 'launch.sh');
    writeFileSync(script, extractHeredoc(readUserData(), 'LAUNCH') + '\n');
    const ops = join(dir, 'ops.log');
    const awsLog = join(dir, 'aws.log');
    const completed = join(dir, 'var', 'launch-completed');
    writeFileSync(ops, '');
    writeFileSync(awsLog, '');
    if (failedMarker) writeFileSync(join(runDir, 'migration-gate-failed'), '');

    const result = spawnSync('bash', [script], {
        encoding: 'utf8',
        env: {
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SIGLENS_RUN_DIR: runDir,
            SIGLENS_OPS_LOG: ops,
            SIGLENS_LAUNCH_COMPLETED: completed,
            FAKE_AWS_LOG: awsLog,
            FAKE_AWS_EXIT: String(awsExit),
            FAKE_IMDS_FAIL: imdsFail ? '1' : '0',
        },
    });
    return {
        status: result.status,
        ops: readFileSync(ops, 'utf8'),
        awsCalls: readFileSync(awsLog, 'utf8')
            .split('\n')
            .filter(line => line.length > 0),
        completed: existsSync(completed),
    };
}

afterEach(() => {
    dirs.splice(0).forEach(dir =>
        rmSync(dir, { recursive: true, force: true })
    );
});

describe('siglens-lifecycle-launch.sh', () => {
    it('게이트가 막았으면 즉시 ABANDON하고 ops 로그에 남긴다', () => {
        const r = run({ failedMarker: true });
        expect(r.status).toBe(0);
        expect(
            r.awsCalls.some(
                call =>
                    call.includes('--lifecycle-action-result ABANDON') &&
                    call.includes('siglens-launch-gate') &&
                    call.includes('i-0abc')
            )
        ).toBe(true);
        expect(r.awsCalls.some(call => call.includes('CONTINUE'))).toBe(false);
        expect(r.ops).toContain(
            '[lifecycle-launch] migration gate failed, abandoning'
        );
        expect(r.completed).toBe(false);
    });

    it('ABANDON 호출이 실패하면 기본 ABANDON을 기다린다는 줄을 남긴다', () => {
        const r = run({ failedMarker: true, awsExit: 1 });
        expect(r.status).toBe(0);
        expect(r.ops).toContain(
            '[lifecycle-launch] ABANDON failed; hook defaults to ABANDON at 600s'
        );
        expect(r.ops).not.toContain('migration gate failed, abandoning');
    });

    it('게이트가 막았는데 IMDS를 못 읽으면 조용히 끝내지 않고 남긴다', () => {
        const r = run({ failedMarker: true, imdsFail: true });
        expect(r.status).toBe(0);
        expect(r.awsCalls).toEqual([]);
        expect(r.ops).toContain('IMDS instance-id unavailable');
    });

    it('정상이면 CONTINUE 뒤에 launch-completed 표식을 남긴다', () => {
        const r = run({});
        expect(r.status).toBe(0);
        expect(
            r.awsCalls.some(
                call =>
                    call.includes('--lifecycle-action-result CONTINUE') &&
                    call.includes('siglens-launch-gate')
            )
        ).toBe(true);
        expect(r.completed).toBe(true);
    });

    it('CONTINUE가 실패하면 표식을 남기지 않고 실패로 끝난다', () => {
        const r = run({ awsExit: 1 });
        expect(r.status).not.toBe(0);
        expect(r.completed).toBe(false);
    });

    it('정상 경로에서 IMDS를 못 읽으면 로그를 남기고 aws를 부르지 않는다', () => {
        const r = run({ imdsFail: true });
        expect(r.status).toBe(0);
        expect(r.awsCalls).toEqual([]);
        expect(r.ops).toContain('IMDS instance-id unavailable');
        expect(r.completed).toBe(false);
    });
});
