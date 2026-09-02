import { describe, expect, it } from 'vitest';
import { buildVisitorHash } from '@/entities/visitor/lib/visitorHash';

const PEPPER = 'test-pepper';
const IP = '203.0.113.10';
const UA = 'Mozilla/5.0 (Macintosh) Chrome/140.0.0.0';

describe('buildVisitorHash', () => {
    it('같은 입력에 같은 해시를 준다', () => {
        expect(buildVisitorHash(PEPPER, IP, UA)).toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('64자 hex를 반환한다', () => {
        expect(buildVisitorHash(PEPPER, IP, UA)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('pepper가 다르면 다른 해시가 된다', () => {
        expect(buildVisitorHash('other-pepper', IP, UA)).not.toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('같은 IP라도 User-Agent가 다르면 다른 해시가 된다', () => {
        // 통신사 NAT 뒤의 서로 다른 사람이 1명으로 뭉치는 것을 줄인다.
        expect(buildVisitorHash(PEPPER, IP, 'Mozilla/5.0 (iPhone)')).not.toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('날짜를 섞지 않는다 — 그래야 MAU가 성립한다', () => {
        // core의 hashUsageIp와의 결정적 차이. 이 함수는 시간에 의존하지 않는다.
        const first = buildVisitorHash(PEPPER, IP, UA);
        const second = buildVisitorHash(PEPPER, IP, UA);
        expect(first).toBe(second);
        // 날짜가 섞인 pepper와도 달라야 한다(같으면 salt가 새어든 것이다).
        expect(first).not.toBe(
            buildVisitorHash(`${PEPPER}:2026-09-02`, IP, UA)
        );
    });

    it('pepper가 비어 있으면 던진다', () => {
        // 무염 SHA-256은 IPv4 2^32를 전수 대입하면 즉시 역산된다.
        expect(() => buildVisitorHash('', IP, UA)).toThrow(
            /VISITOR_HASH_PEPPER/
        );
    });
});
