/**
 * Unit tests for scripts/agent-eval/localGuard.mjs: the dev server must not start when the database or the Redis REST
 * address it would use is not local. The values below are made-up fixtures, never real addresses or tokens.
 */
import { describe, expect, it } from 'vitest';
import {
    checkAll,
    checkLocalEndpoint,
    effectiveValue,
    GUARDED_VARIABLES,
    hostPortOf,
    readEnvFileValue,
} from '../agent-eval/localGuard.mjs';

const E2E = [
    'E2E_TEST=1',
    'DATABASE_URL=postgres://e2e:secret@localhost:5433/siglens_e2e',
    'UPSTASH_REDIS_REST_URL=http://localhost:8079',
    'UPSTASH_REDIS_REST_TOKEN=e2e-token',
].join('\n');

describe('localGuard', () => {
    it('앱이 읽는 DB·Redis 주소 변수 둘을 검사한다', () => {
        expect(GUARDED_VARIABLES).toEqual([
            'DATABASE_URL',
            'UPSTASH_REDIS_REST_URL',
        ]);
    });

    it('통과: 로컬 호스트(localhost, 127.0.0.1, ::1)', () => {
        [
            'http://localhost:8079',
            'http://127.0.0.1:8079',
            'http://[::1]:8079',
            'postgres://u:p@localhost:5433/db',
        ].forEach(value =>
            expect(checkLocalEndpoint('X', value).ok).toBe(true)
        );
    });

    it('실패: 원격 호스트, 로컬처럼 보이는 호스트, 깨진 값', () => {
        [
            'https://example-redis.upstash.io',
            'postgres://u:p@db.internal.example.com:5432/x',
            'http://localhost.evil.example.com',
            'http://evil.example.com/localhost',
            'not a url',
        ].forEach(value =>
            expect(checkLocalEndpoint('X', value).ok).toBe(false)
        );
    });

    it('실패: 사용자 정보로 로컬을 흉내 낸 주소, *.localhost, 끝점이 붙은 호스트', () => {
        [
            'http://localhost@remote.example.com/',
            'postgres://localhost:5432@db.example.com/x',
            'http://127.0.0.1@remote.example.com:8079',
            'http://db.localhost:5432',
            'postgres://u:p@ai.localhost:5433/db',
            'http://localhost.:8079',
        ].forEach(value =>
            expect(checkLocalEndpoint('X', value).ok).toBe(false)
        );
    });

    it('사용자 정보가 붙은 원격 주소는 호스트와 포트만 남긴다', () => {
        expect(
            checkLocalEndpoint(
                'X',
                'postgres://localhost:5432@db.example.com/x'
            )
        ).toMatchObject({ ok: false, hostPort: 'db.example.com' });
    });

    it('실패: 값이 비었거나 없다', () => {
        expect(checkLocalEndpoint('X', undefined)).toMatchObject({
            ok: false,
            reason: 'not set',
        });
        expect(checkLocalEndpoint('X', '').ok).toBe(false);
    });

    it('셸 값이 없거나 비어 있으면 .env.e2e 값으로 돌아간다', () => {
        expect(effectiveValue('UPSTASH_REDIS_REST_URL', {}, E2E)).toBe(
            'http://localhost:8079'
        );
        expect(
            effectiveValue(
                'UPSTASH_REDIS_REST_URL',
                { UPSTASH_REDIS_REST_URL: '' },
                E2E
            )
        ).toBe('http://localhost:8079');
        expect(checkAll(GUARDED_VARIABLES, {}, E2E).every(r => r.ok)).toBe(
            true
        );
    });

    it('셸 값이 있으면 .env.e2e보다 우선하므로 원격 Redis 값은 거절된다', () => {
        const results = checkAll(
            GUARDED_VARIABLES,
            { UPSTASH_REDIS_REST_URL: 'https://remote-redis.example.com' },
            E2E
        );
        expect(results.find(r => r.name === 'DATABASE_URL')?.ok).toBe(true);
        expect(results.find(r => r.name === 'UPSTASH_REDIS_REST_URL')).toEqual({
            name: 'UPSTASH_REDIS_REST_URL',
            ok: false,
            hostPort: 'remote-redis.example.com',
            reason: 'not local',
        });
    });

    it('셸의 원격 DB 값도 거절한다', () => {
        const results = checkAll(
            GUARDED_VARIABLES,
            { DATABASE_URL: 'postgres://u:p@db.example.com:5432/x' },
            E2E
        );
        expect(results.find(r => r.name === 'DATABASE_URL')?.ok).toBe(false);
    });

    it('.env.e2e에도 없으면 거절한다', () => {
        expect(
            checkAll(['UPSTASH_REDIS_REST_URL'], {}, 'E2E_TEST=1')[0]
        ).toMatchObject({
            ok: false,
            reason: 'not set',
        });
    });

    it('자격 증명이 든 주소는 호스트:포트만 내놓는다', () => {
        const value =
            'postgres://admin:s3cr3t-p%40ss@localhost:5433/siglens?sslmode=disable';
        const result = checkLocalEndpoint('DATABASE_URL', value);
        expect(result.hostPort).toBe('localhost:5433');
        const printed = JSON.stringify(result);
        ['admin', 's3cr3t', 'siglens', 'sslmode'].forEach(secret =>
            expect(printed).not.toContain(secret)
        );
        expect(hostPortOf('https://:tok3n@remote.example.com/path?x=1')).toBe(
            'remote.example.com'
        );
    });

    it('해석할 수 없는 값은 호스트:포트가 null이라 원문이 새지 않는다', () => {
        expect(
            checkLocalEndpoint('X', 'garbage-with-secret').hostPort
        ).toBeNull();
    });

    it('readEnvFileValue: export 접두·따옴표를 받고 마지막 줄을 쓰며 없으면 undefined', () => {
        const text = ['A=1', 'export B="two"', "  C='three'", 'B=last'].join(
            '\n'
        );
        expect(readEnvFileValue(text, 'A')).toBe('1');
        expect(readEnvFileValue(text, 'B')).toBe('last');
        expect(readEnvFileValue(text, 'C')).toBe('three');
        expect(readEnvFileValue(text, 'D')).toBeUndefined();
        expect(readEnvFileValue('AA=1', 'A')).toBeUndefined();
    });
});
