import { describe, expect, it, vi } from 'vitest';

vi.mock('../benchmark', () => ({
    BENCHMARK_PUBLISHED: true,
    BENCHMARK_PATH: '/benchmark',
}));

import { AI_INDEXABLE_PATHS } from '../aiHost';

describe('AI_INDEXABLE_PATHS once the benchmark gate is open', () => {
    it('adds /benchmark after the existing pages', () => {
        expect(AI_INDEXABLE_PATHS).toEqual(['/', '/about', '/benchmark']);
    });
});
