import path from 'path';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';
import { parseSeedFile, validateSeedFiles } from '@/../db/scripts/seedTerms';

describe('db/seeds/terms (real files)', () => {
    it('every seed parses and the set validates (no version gap, no orphan translation)', async () => {
        const root = path.resolve(process.cwd(), 'db/seeds/terms');
        const files = await glob('**/*.md', { cwd: root, absolute: true });
        const seeds = files.map(parseSeedFile);
        expect(() => validateSeedFiles(seeds)).not.toThrow();
        expect(
            seeds
                .filter(s => s.kind === 'privacy' && s.version === 5)
                .map(s => s.locale ?? 'ko')
                .toSorted()
        ).toEqual(['en', 'ja', 'ko', 'zh']);
    });
});
