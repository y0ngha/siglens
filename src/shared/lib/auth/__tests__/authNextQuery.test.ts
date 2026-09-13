import { describe, expect, it } from 'vitest';
import { authNextQuery } from '@/shared/lib/auth';

describe('authNextQuery', () => {
    it('is empty without a target (main host keeps the plain /login href)', () => {
        expect(authNextQuery()).toBe('');
        expect(authNextQuery('')).toBe('');
    });

    it('encodes the handoff path once so the login page reads it back intact', () => {
        expect(authNextQuery('/api/auth/handoff?to=ai&next=%2F')).toBe(
            '?next=%2Fapi%2Fauth%2Fhandoff%3Fto%3Dai%26next%3D%252F'
        );
    });
});
