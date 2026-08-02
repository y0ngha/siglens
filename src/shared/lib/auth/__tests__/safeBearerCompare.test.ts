import { describe, expect, it } from 'vitest';
import { safeBearerCompare } from '../safeBearerCompare';

describe('safeBearerCompare', () => {
    it('일치하는 Bearer 토큰을 통과시킨다', () => {
        expect(safeBearerCompare('Bearer s3cret', 's3cret')).toBe(true);
    });

    it('시크릿이 다르면 거부한다', () => {
        expect(safeBearerCompare('Bearer wrong', 's3cret')).toBe(false);
    });

    it('헤더가 없으면(null) 거부한다', () => {
        expect(safeBearerCompare(null, 's3cret')).toBe(false);
    });

    it('Bearer 접두어가 없으면 거부한다', () => {
        expect(safeBearerCompare('s3cret', 's3cret')).toBe(false);
    });

    it('길이가 다르면 timingSafeEqual에 도달하지 않고 거부한다', () => {
        // timingSafeEqual은 길이가 다른 버퍼에 대해 throw하므로,
        // 이 케이스가 예외 없이 false를 반환하는 것이 길이 선검사의 존재 근거다.
        expect(() => safeBearerCompare('Bearer sh', 's3cret')).not.toThrow();
        expect(safeBearerCompare('Bearer sh', 's3cret')).toBe(false);
    });

    it('멀티바이트 시크릿도 바이트 단위로 정확히 비교한다', () => {
        expect(safeBearerCompare('Bearer 시크릿', '시크릿')).toBe(true);
        expect(safeBearerCompare('Bearer 시크릿', '시크')).toBe(false);
    });

    it('expected가 빈 문자열이면 "Bearer "만 보낸 요청이 통과한다 — 호출 측이 막아야 하는 함정', () => {
        // 이 함수는 빈 시크릿을 스스로 거부하지 않는다. 그래서 모든 호출 측이
        // `if (!process.env.CRON_SECRET) return 401`을 먼저 수행한다.
        // 그 계약이 깨지면 어떻게 뚫리는지를 여기서 고정해 둔다.
        expect(safeBearerCompare('Bearer ', '')).toBe(true);
        expect(safeBearerCompare('Bearer x', '')).toBe(false);
    });
});
