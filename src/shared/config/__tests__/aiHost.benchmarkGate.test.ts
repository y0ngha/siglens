import { describe, expect, it, vi } from 'vitest';

// 게이트를 명시적으로 닫는다 — 공개 PR이 실제 상수를 올려도 이 파일은 그대로 통과한다.
vi.mock('../benchmark', () => ({
    BENCHMARK_PUBLISHED: false,
    BENCHMARK_PATH: '/benchmark',
}));

import { AI_INDEXABLE_PATHS } from '../aiHost';
import { BENCHMARK_PATH } from '../benchmark';

describe('AI_INDEXABLE_PATHS while the benchmark gate is shut', () => {
    it('lists only the landing and /about', () => {
        expect(AI_INDEXABLE_PATHS).toEqual(['/', '/about']);
        expect(AI_INDEXABLE_PATHS).not.toContain(BENCHMARK_PATH);
    });
});
