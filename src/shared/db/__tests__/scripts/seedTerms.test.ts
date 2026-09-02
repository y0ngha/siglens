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
        expect(result.effectiveDate?.toISOString()).toBe(
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

    it('effectiveDate 없이 locale이 있으면 번역 시드로 파싱한다', () => {
        const file = writeFixture(
            tmp,
            'v1.en.md',
            `---
kind: privacy
version: 1
locale: en
---

## 1. General
`
        );

        const result = parseSeedFile(file);

        expect(result.locale).toBe('en');
        expect(result.effectiveDate).toBeUndefined();
        expect(result.body.trim()).toMatch(/^## 1\. General/);
    });

    it('locale도 effectiveDate도 없으면 던진다', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: privacy
version: 1
---

## body
`
        );

        expect(() => parseSeedFile(file)).toThrow(/effectiveDate/);
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
            validateSeedFiles([makeSeed('privacy', 1), makeSeed('privacy', 3)])
        ).toThrow(/version gap/);
    });

    it('rejects duplicate (kind, version)', () => {
        expect(() =>
            validateSeedFiles([makeSeed('privacy', 1), makeSeed('privacy', 1)])
        ).toThrow(/duplicate/);
    });
});

describe('validateSeedFiles — 번역 시드', () => {
    function base(version: number): ParsedSeed {
        return {
            kind: 'privacy',
            version,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## 1. 총칙',
            sourceFile: `privacy/v${version}.md`,
        };
    }

    function translation(
        version: number,
        locale: 'en' | 'ja' | 'zh'
    ): ParsedSeed {
        return {
            kind: 'privacy',
            version,
            locale,
            body: '## 1. General',
            sourceFile: `privacy/v${version}.${locale}.md`,
        };
    }

    it('번역은 버전 연속성 검사에서 제외된다', () => {
        // 번역 3개가 v1을 공유해도 "중복 v1"이 아니다.
        expect(() =>
            validateSeedFiles([
                base(1),
                translation(1, 'en'),
                translation(1, 'ja'),
                translation(1, 'zh'),
            ])
        ).not.toThrow();
    });

    it('원문 버전이 겹치면 여전히 던진다', () => {
        expect(() => validateSeedFiles([base(1), base(1)])).toThrow(
            /duplicate seed/
        );
    });

    it('원문 버전에 구멍이 있으면 여전히 던진다', () => {
        expect(() => validateSeedFiles([base(1), base(3)])).toThrow(
            /version gap/
        );
    });

    it('짝이 되는 원문이 없는 번역은 던진다', () => {
        // 버전 오타 하나가 조용히 고아 번역 행을 만드는 것을 막는다.
        expect(() =>
            validateSeedFiles([base(1), translation(2, 'en')])
        ).toThrow(/orphan translation/);
    });
});
