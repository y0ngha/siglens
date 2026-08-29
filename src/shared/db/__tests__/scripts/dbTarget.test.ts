import { afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    assertRemoteWriteAllowed,
    describeTarget,
    formatTarget,
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
