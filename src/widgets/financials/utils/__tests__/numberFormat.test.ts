import { describe, it, expect } from 'vitest';
import { DEFAULT_STATEMENT_CURRENCY } from '../numberFormat';

describe('DEFAULT_STATEMENT_CURRENCY', () => {
    it('is USD', () => {
        expect(DEFAULT_STATEMENT_CURRENCY).toBe('USD');
    });
});
