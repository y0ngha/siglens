import path from 'path';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
    parseSeedFile,
    validateSeedFiles,
    type ParsedSeed,
} from '@/../db/scripts/seedTerms';

function writeFixture(dir: string, name: string, body: string): string {
    const file = path.join(dir, name);
    writeFileSync(file, body, 'utf-8');
    return file;
}

describe('seedTerms — parseSeedFile', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = mkdtempSync(path.join(tmpdir(), 'seed-terms-'));
    });

    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    it('parses a valid markdown seed file', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: privacy
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---

## 1. 총칙

본 문서는 ...
`
        );

        const result = parseSeedFile(file);

        expect(result.kind).toBe('privacy');
        expect(result.version).toBe(1);
        expect(result.effectiveDate.toISOString()).toBe(
            new Date('2026-04-30T00:00:00+09:00').toISOString()
        );
        expect(result.body.trim()).toMatch(/^## 1\. 총칙/);
    });

    it('throws on missing frontmatter field', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: privacy
---

## body
`
        );

        expect(() => parseSeedFile(file)).toThrow(/version/);
    });

    it('throws on invalid kind value', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: marketing
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---

## body
`
        );

        expect(() => parseSeedFile(file)).toThrow(/kind/);
    });
});

describe('seedTerms — validateSeedFiles', () => {
    function makeSeed(kind: 'privacy' | 'tos', version: number): ParsedSeed {
        return {
            kind,
            version,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## body',
            sourceFile: `${kind}-v${version}.md`,
        };
    }

    it('accepts contiguous version sequence per kind', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 2),
                makeSeed('tos', 1),
            ])
        ).not.toThrow();
    });

    it('rejects version gap', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 3),
            ])
        ).toThrow(/version gap/);
    });

    it('rejects duplicate (kind, version)', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 1),
            ])
        ).toThrow(/duplicate/);
    });
});
