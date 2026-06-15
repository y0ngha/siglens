import { describe, expect, it } from 'vitest';
import { revalidate } from '@/app/[symbol]/financials/page';

describe('Financials page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(86400);
    });
});
