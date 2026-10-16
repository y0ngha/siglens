import { describe, expect, it } from 'vitest';
import { isDefaultOnFlagEnabled } from '../defaultOnEnvFlag';

describe('isDefaultOnFlagEnabled', () => {
    it('is on when the flag is unset', () => {
        expect(isDefaultOnFlagEnabled(undefined)).toBe(true);
    });

    it.each(['', '  ', 'true', 'TRUE', '1', 'yes', 'anything'])(
        'is on for %j',
        value => {
            expect(isDefaultOnFlagEnabled(value)).toBe(true);
        }
    );

    it.each(['false', 'FALSE', '0', 'off', 'No', ' false '])(
        'is off for %j',
        value => {
            expect(isDefaultOnFlagEnabled(value)).toBe(false);
        }
    );
});
