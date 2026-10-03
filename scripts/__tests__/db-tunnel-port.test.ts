import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_TUNNEL_PORT } from '../../db/scripts/lib/dbTarget';

const root = process.cwd();

function read(relative: string): string {
    return readFileSync(join(root, relative), 'utf8');
}

/** 첫 번째 캡처 그룹의 숫자 리터럴. 못 찾으면 던진다 — 공회전 방지. */
function literal(source: string, pattern: RegExp, where: string): number {
    const match = pattern.exec(source);
    if (match?.[1] === undefined) {
        throw new Error(`${where}: 터널 포트 리터럴을 찾지 못했다`);
    }
    return Number(match[1]);
}

/**
 * 터널 포트는 세 곳에 따로 적힌다(TS 상수, 셸 스크립트 둘). 하나만 바뀌면
 * dbTarget이 REMOTE로 분류하는 포트와 터널이 실제로 여는 포트가 어긋나, 운영
 * 터널이 쓰기 가드를 통째로 연다. 각 파일에서 리터럴을 직접 파싱해 비교한다.
 */
describe('운영 터널 포트 리터럴 일치', () => {
    const fromDbTarget = literal(
        read('db/scripts/lib/dbTarget.ts'),
        /^export const DB_TUNNEL_PORT = (\d+);$/m,
        'db/scripts/lib/dbTarget.ts'
    );
    const fromTunnel = literal(
        read('scripts/db-tunnel.sh'),
        /^readonly TUNNEL_PORT=(\d+)$/m,
        'scripts/db-tunnel.sh'
    );
    const fromSeed = literal(
        read('scripts/db-dev-seed-from-prod.sh'),
        /^readonly TUNNEL_PORT=(\d+)$/m,
        'scripts/db-dev-seed-from-prod.sh'
    );

    it('세 파일의 값이 같다', () => {
        expect(fromTunnel).toBe(fromDbTarget);
        expect(fromSeed).toBe(fromDbTarget);
    });

    it('import한 상수도 소스 리터럴과 같다', () => {
        expect(DB_TUNNEL_PORT).toBe(fromDbTarget);
    });
});

describe('db-dev.sh', () => {
    /** 로컬 DB를 터널 포트로 띄우면 dbTarget이 운영으로 오인한다. */
    it('DEV_DB_PORT가 터널 포트면 docker에 닿기 전에 거부한다', () => {
        const result = spawnSync(
            'bash',
            [join(root, 'scripts/db-dev.sh'), 'up'],
            {
                encoding: 'utf8',
                env: {
                    // docker가 PATH에 없어도 이 분기는 그 전에 끝나야 한다.
                    PATH: '/usr/bin:/bin',
                    DEV_DB_PORT: String(DB_TUNNEL_PORT),
                },
            }
        );
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`DEV_DB_PORT=${DB_TUNNEL_PORT}`);
        expect(result.stderr).toContain('운영 터널 포트');
    });
});
