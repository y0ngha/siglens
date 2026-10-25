import { describe, expect, it } from 'vitest';
import { BENCHMARK_PATH } from '../benchmark';

describe('benchmark config', () => {
    it('uses the site path that the proxy reserves', () => {
        expect(BENCHMARK_PATH).toBe('/benchmark');
    });
});
