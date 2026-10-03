import { afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    DB_TUNNEL_PORT,
    assertRemoteWriteAllowed,
    describeTarget,
    formatTarget,
    guardRemoteWrite,
} from '../../../../../db/scripts/lib/dbTarget';

const ORIGINAL = process.env.ALLOW_REMOTE_DB_WRITE;

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ALLOW_REMOTE_DB_WRITE;
    else process.env.ALLOW_REMOTE_DB_WRITE = ORIGINAL;
});

describe('describeTarget', () => {
    it.each([
        'postgresql://u:p@localhost:5433/db',
        'postgresql://u:p@127.0.0.1:5432/db',
        'postgresql://u:p@postgres:5432/db',
    ])('%s 는 로컬이다', url => {
        expect(describeTarget(url).isLocal).toBe(true);
    });

    it('Neon 호스트는 원격이다', () => {
        const target = describeTarget(
            'postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/neondb'
        );
        expect(target.isLocal).toBe(false);
        expect(target.host).toBe('ep-x.ap-southeast-1.aws.neon.tech');
        expect(target.database).toBe('neondb');
    });

    /**
     * 모양이 이상한 URL을 안전한 쪽(로컬)으로 넘기면, 가드가 정작 필요한
     * 순간에 열려 버린다. fail-closed가 맞다.
     */
    it('파싱 실패는 로컬로 보지 않는다 (fail-closed)', () => {
        expect(describeTarget('not-a-url').isLocal).toBe(false);
    });

    /** 이 값은 로그로 나가고 로그는 CloudWatch에 남는다. */
    it('자격증명을 노출하지 않는다', () => {
        const url = 'postgresql://myuser:sup3rs3cret@host.example/db';
        const rendered = formatTarget(describeTarget(url));
        expect(rendered).not.toContain('sup3rs3cret');
        expect(rendered).not.toContain('myuser');
    });
});

/**
 * 운영 RDS는 private이라 SSM 포트포워딩으로만 닿고, 그 터널은 localhost에 열린다.
 * 호스트 이름만 보면 로컬 Docker와 똑같아서, 포트로 구별하지 않으면 운영 터널이
 * 쓰기 가드를 통째로 연다.
 */
describe('describeTarget — 운영 터널 포트', () => {
    it('터널 포트 상수는 db-tunnel.sh와 같은 6543이다', () => {
        expect(DB_TUNNEL_PORT).toBe(6543);
        const script = readFileSync(
            join(process.cwd(), 'scripts/db-tunnel.sh'),
            'utf8'
        );
        // 환경변수로 덮어쓸 수 없는 고정 상수여야 한다 — 바꾸면 가드 판정이 어긋난다.
        expect(script).toMatch(/^readonly TUNNEL_PORT=6543$/m);
    });

    it('localhost:5435 (로컬 개발 DB) 는 로컬이다', () => {
        const target = describeTarget(
            'postgres://siglens:siglens@localhost:5435/siglens_dev'
        );
        expect(target.isLocal).toBe(true);
        expect(target.viaTunnel).toBe(false);
    });

    it.each([
        'postgres://u:p@localhost:6543/db',
        'postgres://u:p@127.0.0.1:6543/db',
        'postgres://u:p@[::1]:6543/db',
        'postgres://u:p@host.docker.internal:6543/db',
    ])('%s 는 호스트가 로컬이어도 원격(운영 터널)이다', url => {
        const target = describeTarget(url);
        expect(target.isLocal).toBe(false);
        expect(target.viaTunnel).toBe(true);
    });

    it('포트 생략(기본 5432)은 로컬이다', () => {
        expect(describeTarget('postgres://u:p@localhost/db').isLocal).toBe(
            true
        );
    });

    it('원격 호스트는 포트와 무관하게 원격이다', () => {
        const target = describeTarget(
            'postgres://u:p@siglens.abc.ap-northeast-2.rds.amazonaws.com:5432/db'
        );
        expect(target.isLocal).toBe(false);
        expect(target.viaTunnel).toBe(false);
    });

    it('formatTarget이 터널 경유 운영임을 밝힌다', () => {
        const rendered = formatTarget(
            describeTarget('postgres://u:p@localhost:6543/siglens')
        );
        expect(rendered).toContain('REMOTE');
        expect(rendered).toContain('PRODUCTION');
    });

    it('터널 URL로는 ALLOW_REMOTE_DB_WRITE=1 없이 쓸 수 없다', () => {
        delete process.env.ALLOW_REMOTE_DB_WRITE;
        const target = describeTarget('postgres://u:p@localhost:6543/siglens');
        expect(() => assertRemoteWriteAllowed(target, 'migrate')).toThrow(
            /거부: 'migrate'/
        );
    });
});

describe('guardRemoteWrite', () => {
    it('로컬 대상은 통과하고 대상을 돌려준다', () => {
        const target = guardRemoteWrite(
            'postgres://u:p@localhost:5435/siglens_dev',
            'seed'
        );
        expect(target.isLocal).toBe(true);
    });

    it('대상을 찍는다 — 자격증명은 빼고', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            guardRemoteWrite('postgres://u:sup3rs3cret@localhost/db', 'seed');
            const printed = log.mock.calls.map(c => String(c[0])).join('\n');
            expect(printed).toContain('[db] target: localhost/db (local)');
            expect(printed).not.toContain('sup3rs3cret');
        } finally {
            log.mockRestore();
        }
    });

    it('원격(운영 터널 포함)은 ALLOW_REMOTE_DB_WRITE=1 없이 거부한다', () => {
        delete process.env.ALLOW_REMOTE_DB_WRITE;
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            expect(() =>
                guardRemoteWrite('postgres://u:p@localhost:6543/db', 'seed')
            ).toThrow(/거부: 'seed'/);
            expect(() =>
                guardRemoteWrite('postgres://u:p@ep-x.neon.tech/db', 'seed')
            ).toThrow(/ep-x\.neon\.tech/);
        } finally {
            log.mockRestore();
        }
    });
});

describe('assertRemoteWriteAllowed', () => {
    it('로컬 대상은 그냥 통과한다', () => {
        const target = describeTarget('postgresql://u:p@localhost:5433/db');
        expect(() =>
            assertRemoteWriteAllowed(target, 'backfill')
        ).not.toThrow();
    });

    /**
     * `.env.local`이 운영 Neon을 가리킨다. `--apply` 하나로 운영에 쓰이면
     * 되돌릴 수 없다.
     */
    it('원격 대상은 기본 거부한다', () => {
        delete process.env.ALLOW_REMOTE_DB_WRITE;
        const target = describeTarget('postgresql://u:p@ep-x.neon.tech/neondb');
        expect(() => assertRemoteWriteAllowed(target, 'migrate')).toThrow(
            /거부: 'migrate'/
        );
    });

    it('거부 메시지가 대상 호스트를 밝힌다 — 무엇을 막았는지 알아야 한다', () => {
        delete process.env.ALLOW_REMOTE_DB_WRITE;
        const target = describeTarget('postgresql://u:p@ep-x.neon.tech/neondb');
        expect(() => assertRemoteWriteAllowed(target, 'backfill')).toThrow(
            /ep-x\.neon\.tech/
        );
    });

    it('ALLOW_REMOTE_DB_WRITE=1 이면 통과한다', () => {
        process.env.ALLOW_REMOTE_DB_WRITE = '1';
        const target = describeTarget('postgresql://u:p@ep-x.neon.tech/neondb');
        expect(() => assertRemoteWriteAllowed(target, 'migrate')).not.toThrow();
    });

    /** 실수로 칠 수 있는 값이면 가드가 아니다. */
    it.each(['true', 'yes', '0', ''])('%s 로는 열리지 않는다', value => {
        process.env.ALLOW_REMOTE_DB_WRITE = value;
        const target = describeTarget('postgresql://u:p@ep-x.neon.tech/neondb');
        expect(() => assertRemoteWriteAllowed(target, 'migrate')).toThrow();
    });
});

/**
 * 가드를 만들어 두고 스크립트가 부르지 않으면 아무 소용이 없다 — 이 레포가
 * 겪은 silently-inert 결함군이다.
 */
describe('쓰기 스크립트가 실제로 가드를 부른다', () => {
    it.each([
        ['db/scripts/migrate.ts', 'migrate'],
        ['db/scripts/backfillContentLocale.ts', 'backfill'],
        ['db/scripts/translateContentLocale.ts', 'translate'],
    ])('%s', (file, operation) => {
        const source = readFileSync(join(process.cwd(), file), 'utf8');
        expect(source).toContain('assertRemoteWriteAllowed');
        expect(source).toContain(`'${operation}'`);
    });

    /** 읽기 전용 점검은 막지 않는다 — 다만 대상은 찍어야 한다. */
    it('verify는 쓰기 가드를 걸지 않고 대상만 찍는다', () => {
        const source = readFileSync(
            join(process.cwd(), 'db/scripts/verifyContentLocale.ts'),
            'utf8'
        );
        expect(source).not.toContain('assertRemoteWriteAllowed');
        expect(source).toContain('readDatabaseUrl');
    });
});
