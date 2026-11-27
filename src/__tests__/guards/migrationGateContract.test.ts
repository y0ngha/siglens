import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATION_GATE_STATUS } from '@/app/api/ready/_lib/checkMigrations';
import { extractHeredoc, readUserData } from './support/userDataScripts';

/**
 * **마이그레이션 게이트 계약 가드.**
 *
 * 게이트는 세 곳에 걸쳐 있다: 앱 라우트(`/api/ready/migrations`), 박스의 셸 스크립트(user-data.sh),
 * 이미지(Dockerfile). 한 곳만 바뀌면 에러 없이 게이트가 꺼진다(예: 스크립트가 옛 status 문자열을 계속
 * 기다림, 이미지에 저널이 없어 항상 `manifest_unavailable`). 그 어긋남을 여기서 잡는다.
 */
const ROOT = path.resolve(__dirname, '../../..');
const userData = readUserData();
const waitMigrations = extractHeredoc(userData, 'MIGGATE');
const waitHealthy = extractHeredoc(userData, 'WAIT');
const selfcheck = extractHeredoc(userData, 'CHK');
const launch = extractHeredoc(userData, 'LAUNCH');
const cloudflaredUnit = (() => {
    const match = /cloudflared\.service <<TUNNEL\n([\s\S]*?)\nTUNNEL\n/.exec(
        userData
    );
    if (match === null) throw new Error('cloudflared unit heredoc not found');
    return match[1];
})();
const dockerfile = readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
const runnerStage = dockerfile.slice(dockerfile.indexOf('AS runner'));
const deploySh = readFileSync(path.join(ROOT, 'infra/aws/deploy.sh'), 'utf8');

function numberAfter(source: string, pattern: RegExp): number {
    const match = pattern.exec(source);
    if (match === null) throw new Error(`pattern not found: ${pattern}`);
    return Number(match[1]);
}

describe('migration gate contract', () => {
    it('cloudflared 유닛은 헬스 게이트 다음에 마이그레이션 게이트를 ExecStartPre로 건다', () => {
        const pres = cloudflaredUnit
            .split('\n')
            .filter(line => line.startsWith('ExecStartPre='));
        expect(pres).toEqual([
            'ExecStartPre=/usr/local/bin/siglens-wait-healthy.sh',
            'ExecStartPre=/usr/local/bin/siglens-wait-migrations.sh',
        ]);
    });

    it('TimeoutStartSec는 두 게이트의 최악 합 + 여유 이상이다', () => {
        const healthy =
            numberAfter(waitHealthy, /seq 1 (\d+)/) *
            (numberAfter(waitHealthy, /curl -fsS -m (\d+)/) +
                numberAfter(waitHealthy, /sleep (\d+)/));
        const attempts = numberAfter(waitMigrations, /seq 1 (\d+)/);
        const curlMax = numberAfter(waitMigrations, /curl -sS -m (\d+)/);
        const pause = numberAfter(waitMigrations, /SIGLENS_GATE_SLEEP:-(\d+)/);
        const worstCase = healthy + attempts * (curlMax + pause);
        const timeout = numberAfter(cloudflaredUnit, /TimeoutStartSec=(\d+)/);

        // 60 x (2 + 5) + 12 x (3 + 5)
        expect(worstCase).toBe(420 + 96);
        expect(timeout).toBeGreaterThanOrEqual(worstCase + 20);
    });

    it('게이트가 폴링하는 경로는 실제 라우트 파일이다', () => {
        const url =
            /SIGLENS_MIGRATIONS_URL:-http:\/\/127\.0\.0\.1:3000(\/[^}"]+)\}/.exec(
                waitMigrations
            );
        expect(url).not.toBeNull();
        const route = path.join(ROOT, 'src/app', url?.[1] ?? '', 'route.ts');
        expect(existsSync(route)).toBe(true);
    });

    it('스크립트가 닫는 status 문자열은 앱이 내보내는 상수와 같다', () => {
        const closed = [
            ...waitMigrations.matchAll(/"\$STATUS" = "([a-z_]+)"/g),
        ].map(match => match[1]);
        expect(closed.toSorted()).toEqual(
            [
                MIGRATION_GATE_STATUS.missing,
                MIGRATION_GATE_STATUS.manifestUnavailable,
            ].toSorted()
        );
    });

    it('launch 스크립트는 게이트의 실패 표식을 보고 곧바로 ABANDON한다', () => {
        const marker = /FAILED="\$RUN_DIR\/([a-z-]+)"/.exec(waitMigrations);
        expect(marker).not.toBeNull();
        expect(launch).toContain(`"$RUN_DIR/${marker?.[1]}"`);
        expect(launch).toContain('--lifecycle-action-result ABANDON');
        expect(launch).toContain('migration gate failed, abandoning');
    });

    it('게이트와 launch 스크립트는 같은 기본 경로(run 디렉터리, launch 표식)를 쓴다', () => {
        const runDir = /RUN_DIR="\$\{SIGLENS_RUN_DIR:-([^}]+)\}"/;
        const completed = /COMPLETED="\$\{SIGLENS_LAUNCH_COMPLETED:-([^}]+)\}"/;
        const ops = /OPS="\$\{SIGLENS_OPS_LOG:-([^}]+)\}"/;
        [runDir, completed, ops].forEach(pattern => {
            const gate = pattern.exec(waitMigrations)?.[1];
            const launchValue = pattern.exec(launch)?.[1];
            expect(gate).toBeDefined();
            expect(launchValue).toBe(gate);
        });
        expect(runDir.exec(launch)?.[1]).toBe('/run/siglens');
    });

    it('user-data는 첫 부팅 초입에 launch 표식을 지워 구운 AMI가 물려받지 못하게 한다', () => {
        const marker =
            /COMPLETED="\$\{SIGLENS_LAUNCH_COMPLETED:-([^}]+)\}"/.exec(
                waitMigrations
            )?.[1];
        expect(marker).toBeDefined();
        const topLevel = userData.slice(0, userData.indexOf("<<'"));
        expect(topLevel).toContain(`\nrm -f ${marker}\n`);
    });

    it('launch 스크립트는 CONTINUE가 성공한 뒤에만 launch 표식을 남긴다', () => {
        const continueAt = launch.indexOf('--lifecycle-action-result CONTINUE');
        const touchAt = launch.indexOf('touch "$COMPLETED"');
        expect(continueAt).toBeGreaterThan(-1);
        expect(touchAt).toBeGreaterThan(continueAt);
        expect(launch).toMatch(/CONTINUE \\\n\s+&& \{/);
    });

    it('게이트의 curl은 Cloudflare 헤더를 보내지 않는다(라우트가 그 헤더를 404로 막는다)', () => {
        expect(waitMigrations).not.toMatch(/cf-ray|cf-connecting-ip/i);
        const routeSource = readFileSync(
            path.join(ROOT, 'src/app/api/ready/migrations/route.ts'),
            'utf8'
        );
        expect(routeSource).toContain("'cf-ray'");
        expect(routeSource).toContain("'cf-connecting-ip'");
    });

    it('selfcheck와 헬스 게이트는 여전히 /api/health만 폴링한다', () => {
        expect(selfcheck).toContain('http://127.0.0.1:3000/api/health');
        expect(selfcheck).not.toContain('/api/ready');
        expect(waitHealthy).toContain('http://127.0.0.1:3000/api/health');
        expect(waitHealthy).not.toContain('/api/ready');
    });

    it('runner 이미지는 저널과 SQL을 복사하고 빌드에서 존재를 검증한다', () => {
        expect(runnerStage).toContain(
            '/app/drizzle/meta/_journal.json ./drizzle/meta/_journal.json'
        );
        expect(runnerStage).toContain('/app/drizzle/*.sql ./drizzle/');
        expect(runnerStage).toContain('migrations manifest ok');
        expect(runnerStage).toContain('FAIL: drizzle manifest missing');
    });

    it('deploy.sh는 실패 시 게이트 로그를 보라는 안내를 낸다', () => {
        expect(deploySh).toContain('[migration-gate]');
        expect(deploySh).toContain('db:check:migrations');
        expect(deploySh).toContain('cancel-instance-refresh');
    });
});
