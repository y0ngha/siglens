import { describe, expect, it } from 'vitest';
import { grepFiles } from '@/shared/test-utils/grepSource';

const SLICE = 'src/widgets/benchmark-summary';

describe('benchmark-summary UI import boundary', () => {
    it('keeps entity lib and api modules out of every .tsx file', () => {
        const offenders = grepFiles("@/entities/[^/']+/(lib|api)[/'.]", [
            SLICE,
        ]).filter(
            file => file.endsWith('.tsx') && !file.includes('/__tests__/')
        );
        expect(offenders).toEqual([]);
    });
});
