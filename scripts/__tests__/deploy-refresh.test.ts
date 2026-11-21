import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const INFRA = join(process.cwd(), 'infra/aws');
const TAG = 'v1.2.3';

/** 서브커맨드별로 응답하는 가짜 aws. 모든 호출은 FAKE_AWS_LOG에 한 줄로 남는다. */
const FAKE_AWS = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_AWS_LOG"
case "$1 $2" in
    "ec2 describe-launch-templates") printf '%s' "$FAKE_PREV" ;;
    "ec2 describe-launch-template-versions") printf '%s' "$FAKE_PREV_DESC" ;;
    "autoscaling start-instance-refresh")
        [ "$FAKE_START_FAIL" = '1' ] && exit 254
        printf 'refresh-1' ;;
    "autoscaling describe-instance-refreshes") printf '%s' "$FAKE_REFRESH_LINE" ;;
    "ec2 create-launch-template-version")
        [ "$FAKE_CREATE_FAIL" = '1' ] && exit 1
        printf '9' ;;
esac
exit 0
`;

const dirs: string[] = [];

interface RunOptions {
    /** describe-instance-refreshes가 돌려줄 `Status<TAB>Pct<TAB>Reason` */
    refreshLine: string;
    prev?: string;
    createFails?: boolean;
    startFails?: boolean;
    step05Fails?: boolean;
}

function run({
    refreshLine,
    prev = '7',
    createFails,
    startFails,
    step05Fails,
}: RunOptions) {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-refresh-'));
    dirs.push(dir);
    const infra = join(dir, 'infra');
    const bin = join(dir, 'bin');
    mkdirSync(infra);
    mkdirSync(bin);
    copyFileSync(join(INFRA, 'deploy.sh'), join(infra, 'deploy.sh'));
    copyFileSync(join(INFRA, 'lib.sh'), join(infra, 'lib.sh'));
    writeFileSync(join(infra, '.env'), '');
    writeFileSync(
        join(infra, '05-launch-template.sh'),
        `#!/usr/bin/env bash\n${step05Fails ? 'exit 1' : 'exit 0'}\n`
    );
    writeFileSync(join(bin, 'aws'), FAKE_AWS);
    chmodSync(join(bin, 'aws'), 0o755);
    const log = join(dir, 'aws.log');
    writeFileSync(log, '');

    const result = spawnSync('bash', [join(infra, 'deploy.sh'), TAG], {
        encoding: 'utf8',
        env: {
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SKIP_ENV_CHECK: '1',
            REFRESH_MAX_ITERATIONS: '2',
            REFRESH_POLL_SECONDS: '0',
            FAKE_AWS_LOG: log,
            FAKE_PREV: prev,
            FAKE_REFRESH_LINE: refreshLine,
            FAKE_CREATE_FAIL: createFails ? '1' : '0',
            FAKE_START_FAIL: startFails ? '1' : '0',
            FAKE_PREV_DESC: 'v1.2.2',
        },
    });
    return {
        status: result.status,
        out: result.stdout + result.stderr,
        calls: readFileSync(log, 'utf8')
            .split('\n')
            .filter(line => line.length > 0),
    };
}

afterEach(() => {
    dirs.splice(0).forEach(dir =>
        rmSync(dir, { recursive: true, force: true })
    );
});

const line = (status: string) => `${status}\t100\tgate reason`;
const created = (calls: readonly string[]) =>
    calls.filter(call => call.startsWith('ec2 create-launch-template-version'));
const modified = (calls: readonly string[]) =>
    calls.filter(call => call.startsWith('ec2 modify-launch-template'));

describe.each(['Failed', 'Cancelled'])('deploy.sh refresh %s', status => {
    it('기준점 버전에서 새 버전을 만들어 $Latest를 되돌리고 exit 1', () => {
        const r = run({ refreshLine: line(status) });
        expect(r.status).toBe(1);
        const [create] = created(r.calls);
        expect(create).toContain('--source-version 7');
        expect(create).toContain(`--version-description revert-after-${TAG}`);
        expect(create).toContain('--launch-template-data {}');
        expect(modified(r.calls)).toHaveLength(1);
        expect(modified(r.calls)[0]).toContain('--default-version $Latest');
        expect(r.out).toContain('siglens-lt reverted');
        expect(r.out).toContain('[migration-gate]');
    });

    it('기준점이 없으면(None) 되돌리지 않고 이유를 남긴다', () => {
        const r = run({ refreshLine: line(status), prev: 'None' });
        expect(r.status).toBe(1);
        expect(created(r.calls)).toEqual([]);
        expect(r.out).toContain('not reverting siglens-lt');
    });

    it('되돌림이 실패해도 결과는 exit 1이고 경고를 남기며 기본 버전은 건드리지 않는다', () => {
        const r = run({ refreshLine: line(status), createFails: true });
        expect(r.status).toBe(1);
        expect(modified(r.calls)).toEqual([]);
        expect(r.out).toContain('WARNING: could not revert siglens-lt');
    });
});

describe('deploy.sh refresh outcomes', () => {
    it('Successful이면 되돌리지 않고 exit 0', () => {
        const r = run({ refreshLine: line('Successful') });
        expect(r.status).toBe(0);
        expect(created(r.calls)).toEqual([]);
        expect(modified(r.calls)).toEqual([]);
    });

    it('타임아웃이면 되돌리지 않고 취소 먼저라는 안내를 낸다', () => {
        const r = run({ refreshLine: line('InProgress') });
        expect(r.status).toBe(1);
        expect(created(r.calls)).toEqual([]);
        expect(modified(r.calls)).toEqual([]);
        expect(r.out).toContain(
            `siglens-lt $Latest now points at ${TAG}; cancel the running refresh first, then apply the migration (or restore the template), then rerun`
        );
        expect(r.out).toContain('cancel-instance-refresh');
    });
});

describe('deploy.sh before and around the refresh', () => {
    it('기준점 버전의 설명을 로그에 남기고 되돌림 줄에도 싣는다', () => {
        const r = run({ refreshLine: line('Failed') });
        expect(r.out).toContain(
            'launch template previous latest version: 7 (v1.2.2)'
        );
        expect(r.out).toContain(
            'copy of version 7 (v1.2.2) as revert-after-v1.2.3'
        );
        expect(
            r.calls.some(
                call =>
                    call.startsWith('ec2 describe-launch-template-versions') &&
                    call.includes('--versions 7')
            )
        ).toBe(true);
    });

    it('기준점이 없으면 설명 조회를 하지 않는다', () => {
        const r = run({ refreshLine: line('Successful'), prev: 'None' });
        expect(
            r.calls.some(call =>
                call.startsWith('ec2 describe-launch-template-versions')
            )
        ).toBe(false);
        expect(r.out).toContain(
            'previous latest version: none (no description)'
        );
    });

    it('refresh를 시작하지 못하면 되돌리고 exit 1(폴링 없음)', () => {
        const r = run({ refreshLine: line('Successful'), startFails: true });
        expect(r.status).toBe(1);
        expect(r.out).toContain(`could not start refresh for ${TAG}`);
        expect(created(r.calls)).toHaveLength(1);
        expect(modified(r.calls)).toHaveLength(1);
        expect(
            r.calls.some(call =>
                call.startsWith('autoscaling describe-instance-refreshes')
            )
        ).toBe(false);
    });
});

describe('deploy.sh 05 and rollback states', () => {
    it('05가 실패하면 되돌리고 exit 1(refresh는 시작하지 않는다)', () => {
        const r = run({ refreshLine: line('Successful'), step05Fails: true });
        expect(r.status).toBe(1);
        expect(r.out).toContain(`05 failed for ${TAG}`);
        expect(created(r.calls)).toHaveLength(1);
        expect(modified(r.calls)).toHaveLength(1);
        expect(
            r.calls.some(call =>
                call.startsWith('autoscaling start-instance-refresh')
            )
        ).toBe(false);
    });

    it('05가 실패해도 기준점이 없으면 되돌리지 않는다', () => {
        const r = run({
            refreshLine: line('Successful'),
            step05Fails: true,
            prev: 'None',
        });
        expect(r.status).toBe(1);
        expect(created(r.calls)).toEqual([]);
    });

    it.each(['RollbackSuccessful', 'RollbackFailed'])(
        '%s에서도 템플릿을 되돌리고 exit 1',
        status => {
            const r = run({ refreshLine: line(status) });
            expect(r.status).toBe(1);
            expect(created(r.calls)).toHaveLength(1);
            expect(modified(r.calls)).toHaveLength(1);
            expect(r.out).toContain('siglens-lt reverted');
        }
    );
});
