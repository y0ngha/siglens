import { describe, expect, it } from 'vitest';
import { guestSubject, isGuestSubject } from '@/app/api/ai/chat/guestSubject';

const GUEST_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('guestSubject', () => {
    it('같은 guest id는 항상 같은 subject를 낸다', () => {
        expect(guestSubject(GUEST_ID)).toBe(guestSubject(GUEST_ID));
    });

    it('다른 guest id는 다른 subject를 낸다', () => {
        expect(guestSubject(GUEST_ID)).not.toBe(
            guestSubject('11111111-1111-1111-1111-111111111111')
        );
    });

    it('`guest:` 접두 + guest id를 그대로 담는다(해시 없음)', () => {
        expect(guestSubject(GUEST_ID)).toBe(`guest:${GUEST_ID}`);
    });
});

describe('isGuestSubject', () => {
    it('guestSubject() 값은 true', () => {
        expect(isGuestSubject(guestSubject(GUEST_ID))).toBe(true);
    });

    it('회원 UUID는 false', () => {
        expect(isGuestSubject(GUEST_ID)).toBe(false);
    });
});
