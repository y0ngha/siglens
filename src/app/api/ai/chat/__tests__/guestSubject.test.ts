import { describe, expect, it } from 'vitest';
import { guestSubject, isGuestSubject } from '@/app/api/ai/chat/guestSubject';

describe('guestSubject', () => {
    it('같은 IP는 항상 같은 subject를 낸다', () => {
        expect(guestSubject('203.0.113.7')).toBe(guestSubject('203.0.113.7'));
    });

    it('다른 IP는 다른 subject를 낸다', () => {
        expect(guestSubject('203.0.113.7')).not.toBe(
            guestSubject('198.51.100.1')
        );
    });

    it('`guest:` 접두 + 64자리 hex이고 원본 IP를 담지 않는다', () => {
        const subject = guestSubject('203.0.113.7');
        expect(subject).toMatch(/^guest:[0-9a-f]{64}$/);
        expect(subject).not.toContain('203.0.113.7');
    });
});

describe('isGuestSubject', () => {
    it('guestSubject() 값은 true', () => {
        expect(isGuestSubject(guestSubject('203.0.113.7'))).toBe(true);
    });

    it('회원 UUID는 false', () => {
        expect(isGuestSubject('550e8400-e29b-41d4-a716-446655440000')).toBe(
            false
        );
    });
});
