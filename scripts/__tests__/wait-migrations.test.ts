import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
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

/**
 * 진짜 앱 대신 PATH 앞에 둘 가짜 curl. 호출마다 `FAKE_RESPONSES`의 다음 줄(`코드|본문`)을 돌려주고
 * (줄이 모자라면 마지막 줄 반복), `refused`는 연결 거부(curl 종료 코드 7)를 흉내 낸다.
 * 호출 횟수는 로그 줄 수로 센다.
 */
const FAKE_CURL = `#!/usr/bin/env bash
out=''
prev=''
for arg in "$@"; do
    if [ "$prev" = '-o' ]; then out="$arg"; fi
    prev="$arg"
done
echo call >> "$FAKE_CURL_LOG"
n=$(wc -l < "$FAKE_CURL_LOG" | tr -d ' ')
line=$(sed -n "\${n}p" "$FAKE_RESPONSES")
[ -z "$line" ] && line=$(tail -n 1 "$FAKE_RESPONSES")
code=\${line%%|*}
body=\${line#*|}
if [ "$code" = 'refused' ]; then
    printf '000'
    exit 7
fi
printf '%s' "$body" > "$out"
printf '%s' "$code"
`;

const dirs: string[] = [];

interface RunOptions {
    responses: readonly string[];
    passedMarker?: boolean;
    failedMarker?: boolean;
    /** launch 훅이 CONTINUE까지 끝낸 인스턴스(InService)의 표식 */
    launchCompleted?: boolean;
}

function run({
    responses,
    passedMarker,
    failedMarker,
    launchCompleted,
}: RunOptions) {
    const dir = mkdtempSync(join(tmpdir(), 'wait-migrations-'));
    dirs.push(dir);
    const bin = join(dir, 'bin');
    const runDir = join(dir, 'run');
    const ops = join(dir, 'ops.log');
    const curlLog = join(dir, 'curl.log');
    const responsesFile = join(dir, 'responses.txt');
    const script = join(dir, 'wait-migrations.sh');

    spawnSync('mkdir', ['-p', bin, runDir]);
    writeFileSync(join(bin, 'curl'), FAKE_CURL);
    chmodSync(join(bin, 'curl'), 0o755);
    writeFileSync(script, extractHeredoc(readUserData(), 'MIGGATE') + '\n');
    writeFileSync(curlLog, '');
    writeFileSync(ops, '');
    writeFileSync(responsesFile, responses.join('\n') + '\n');
    if (passedMarker) writeFileSync(join(runDir, 'migration-gate-passed'), '');
    if (failedMarker) writeFileSync(join(runDir, 'migration-gate-failed'), '');
    const completed = join(dir, 'launch-completed');
    if (launchCompleted) writeFileSync(completed, '');

    const result = spawnSync('bash', [script], {
        encoding: 'utf8',
        env: {
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            SIGLENS_RUN_DIR: runDir,
            SIGLENS_OPS_LOG: ops,
            SIGLENS_GATE_SLEEP: '0',
            SIGLENS_LAUNCH_COMPLETED: completed,
            FAKE_CURL_LOG: curlLog,
            FAKE_RESPONSES: responsesFile,
        },
    });
    return {
        status: result.status,
        calls: readFileSync(curlLog, 'utf8')
            .split('\n')
            .filter(line => line.length > 0).length,
        ops: readFileSync(ops, 'utf8'),
        passed: existsSync(join(runDir, 'migration-gate-passed')),
        failed: existsSync(join(runDir, 'migration-gate-failed')),
    };
}

afterEach(() => {
    dirs.splice(0).forEach(dir =>
        rmSync(dir, { recursive: true, force: true })
    );
});

const OK = '200|{"status":"ok","expected":63,"postDeployPending":0}';
const MISSING = '503|{"status":"missing","missing":2}';
const MANIFEST = '503|{"status":"manifest_unavailable"}';
const UNKNOWN = '503|{"status":"unknown","error":"unreachable"}';

describe('siglens-wait-migrations.sh', () => {
    it('200 ok이면 통과 표식을 남기고 0으로 끝난다', () => {
        const r = run({ responses: [OK] });
        expect(r.status).toBe(0);
        expect(r.passed).toBe(true);
        expect(r.failed).toBe(false);
        expect(r.calls).toBe(1);
        expect(r.ops).toContain('[migration-gate] passed (ok)');
    });

    it.each([
        ['report', '200|{"status":"report","missing":1}'],
        ['skipped', '200|{"status":"skipped"}'],
    ])('200 %s도 통과한다', (status, response) => {
        const r = run({ responses: [response] });
        expect(r.status).toBe(0);
        expect(r.ops).toContain(`[migration-gate] passed (${status})`);
    });

    it('503 missing이면 실패 표식을 남기고 개수를 기록하며 1로 끝난다', () => {
        const r = run({ responses: [MISSING] });
        expect(r.status).toBe(1);
        expect(r.failed).toBe(true);
        expect(r.passed).toBe(false);
        expect(r.calls).toBe(1);
        expect(r.ops).toContain('[migration-gate] blocked: missing 2');
    });

    it('503 manifest_unavailable도 닫는다', () => {
        const r = run({ responses: [MANIFEST] });
        expect(r.status).toBe(1);
        expect(r.failed).toBe(true);
        expect(r.ops).toContain(
            '[migration-gate] blocked: manifest_unavailable'
        );
    });

    it('unknown이 계속되면 12번 시도한 뒤 열린 쪽으로 통과한다', () => {
        const r = run({ responses: [UNKNOWN] });
        expect(r.status).toBe(0);
        expect(r.calls).toBe(12);
        expect(r.passed).toBe(true);
        expect(r.ops).toContain(
            '[migration-gate] could not verify (last: 503 unknown), passing'
        );
    });

    it('연결 거부가 계속되어도 12번 뒤 통과한다', () => {
        const r = run({ responses: ['refused|'] });
        expect(r.status).toBe(0);
        expect(r.calls).toBe(12);
        expect(r.ops).toContain('could not verify (last: 000 none), passing');
    });

    it('404는 확정 답이 아니므로 재시도하고 이어서 ok면 통과한다', () => {
        const r = run({ responses: ['404|', '404|', OK] });
        expect(r.status).toBe(0);
        expect(r.calls).toBe(3);
        expect(r.ops).toContain('passed (ok)');
        expect(r.ops).not.toContain('could not verify');
    });

    it('unknown 뒤에 missing이 확정되면 그 자리에서 닫는다', () => {
        const r = run({ responses: [UNKNOWN, UNKNOWN, MISSING] });
        expect(r.status).toBe(1);
        expect(r.calls).toBe(3);
        expect(r.failed).toBe(true);
    });

    it('통과 표식이 있으면 curl을 부르지 않고 0으로 끝난다', () => {
        const r = run({ responses: [MISSING], passedMarker: true });
        expect(r.status).toBe(0);
        expect(r.calls).toBe(0);
    });

    it('실패 표식이 있으면 curl을 부르지 않고 1로 끝난다', () => {
        const r = run({ responses: [OK], failedMarker: true });
        expect(r.status).toBe(1);
        expect(r.calls).toBe(0);
    });

    it('InService 인스턴스(launch 표식)에서 missing이면 통과하되 크게 로그를 남긴다', () => {
        const r = run({ responses: [MISSING], launchCompleted: true });
        expect(r.status).toBe(0);
        expect(r.passed).toBe(true);
        expect(r.failed).toBe(false);
        expect(r.ops).toContain(
            '[migration-gate] blocked on an InService instance, passing (missing 2)'
        );
    });

    it('InService 인스턴스에서 manifest_unavailable도 통과하고 상태를 남긴다', () => {
        const r = run({ responses: [MANIFEST], launchCompleted: true });
        expect(r.status).toBe(0);
        expect(r.failed).toBe(false);
        expect(r.ops).toContain(
            '[migration-gate] blocked on an InService instance, passing (manifest_unavailable)'
        );
    });

    it('launch 표식이 없으면(첫 부팅) missing은 여전히 닫는다', () => {
        const r = run({ responses: [MISSING], launchCompleted: false });
        expect(r.status).toBe(1);
        expect(r.ops).not.toContain('InService');
    });
});
