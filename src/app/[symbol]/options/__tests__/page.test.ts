import { describe, expect, it } from 'vitest';
import { revalidate } from '@/app/[symbol]/options/page';

describe('Options page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(43200);
    });
});
