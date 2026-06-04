import { describe, it, expect, afterEach, vi } from 'vitest';
import { isE2EClient } from '../e2eClientEnv';

describe('isE2EClient', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('(Happy) NEXT_PUBLIC_E2E_TEST=1이면 true', () => {
        vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '1');
        expect(isE2EClient()).toBe(true);
    });

    it('(Worst) 미설정(빈 값)이면 false', () => {
        vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '');
        expect(isE2EClient()).toBe(false);
    });

    it('(Worst) 1이 아닌 값이면 false', () => {
        vi.stubEnv('NEXT_PUBLIC_E2E_TEST', '0');
        expect(isE2EClient()).toBe(false);
    });
});
