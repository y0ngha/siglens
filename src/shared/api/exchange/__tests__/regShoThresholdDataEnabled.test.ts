import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRegShoThresholdDataEnabled } from '../regShoThresholdDataEnabled';

describe('isRegShoThresholdDataEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is on by default (flag unset)', () => {
        vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', undefined);
        expect(isRegShoThresholdDataEnabled()).toBe(true);
    });

    it('is on for an empty value, true and 1', () => {
        for (const value of ['', '  ', 'true', 'TRUE', '1']) {
            vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', value);
            expect(isRegShoThresholdDataEnabled()).toBe(true);
        }
    });

    it.each(['false', 'FALSE', '0', 'off', 'No', ' false '])(
        'is off for %j',
        value => {
            vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', value);
            expect(isRegShoThresholdDataEnabled()).toBe(false);
        }
    );

    it('reads the env at call time (a flip needs no module reload)', () => {
        vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', 'false');
        expect(isRegShoThresholdDataEnabled()).toBe(false);
        vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', 'true');
        expect(isRegShoThresholdDataEnabled()).toBe(true);
    });

    it('does not follow the FINRA flag (each licence has its own switch)', () => {
        vi.stubEnv('FINRA_SHORT_DATA_ENABLED', 'false');
        vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', undefined);
        expect(isRegShoThresholdDataEnabled()).toBe(true);
    });
});
