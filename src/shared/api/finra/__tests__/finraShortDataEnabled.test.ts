import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFinraShortDataEnabled } from '../finraShortDataEnabled';

describe('isFinraShortDataEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is on by default (flag unset)', () => {
        vi.stubEnv('FINRA_SHORT_DATA_ENABLED', undefined);
        expect(isFinraShortDataEnabled()).toBe(true);
    });

    it('is on for an empty value, true and 1', () => {
        for (const value of ['', '  ', 'true', 'TRUE', '1']) {
            vi.stubEnv('FINRA_SHORT_DATA_ENABLED', value);
            expect(isFinraShortDataEnabled()).toBe(true);
        }
    });

    it.each(['false', 'FALSE', '0', 'off', 'No', ' false '])(
        'is off for %j',
        value => {
            vi.stubEnv('FINRA_SHORT_DATA_ENABLED', value);
            expect(isFinraShortDataEnabled()).toBe(false);
        }
    );

    it('reads the env at call time (a flip needs no module reload)', () => {
        vi.stubEnv('FINRA_SHORT_DATA_ENABLED', 'false');
        expect(isFinraShortDataEnabled()).toBe(false);
        vi.stubEnv('FINRA_SHORT_DATA_ENABLED', 'true');
        expect(isFinraShortDataEnabled()).toBe(true);
    });
});
