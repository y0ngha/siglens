/**
 * Unit tests for scripts/skills-digest.ts.
 *
 * Covers the pure string-level helpers (frontmatter split, digest section
 * extraction, hash/token estimation, scalar read/write) plus end-to-end
 * `verifyFileContent` / `updateFileContent` behavior, including an
 * idempotency check against a temp fixture file. No test touches the real
 * `skills/` directory — real skill files currently have no digest section at
 * all (that's expected; digests land in a later PR), so exercising the
 * real tree here would just assert the current transitional state rather
 * than the tool's behavior.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    computeDigestHash,
    DIGEST_END,
    DIGEST_START,
    estimateTokenCost,
    extractDigestSection,
    joinFrontmatter,
    readFrontmatterScalar,
    splitFrontmatter,
    updateFileContent,
    upsertFrontmatterScalar,
    verifyFileContent,
} from '../skills-digest';

const FRONTMATTER = `name: Test Skill
description: a test skill
type: indicator_guide
gating:
  tier: gated
  signal_kind: event
  triggers: [rsi_oversold]
token_cost: 0`;

const BODY = `

## Overview

Some body text describing the skill in detail.
`;

const buildFile = (opts?: { digest?: string; header?: string }): string => {
    const header = opts?.header ?? FRONTMATTER;
    const body =
        opts?.digest === undefined
            ? BODY
            : `${BODY}\n${DIGEST_START}\n${opts.digest}\n${DIGEST_END}\n`;
    return joinFrontmatter(header, body);
};

describe('splitFrontmatter', () => {
    it('splits header and body on the two --- delimiters', () => {
        const content = buildFile();
        const split = splitFrontmatter(content);
        expect(split).not.toBeNull();
        expect(split?.header).toBe(FRONTMATTER);
        expect(split?.body).toBe(BODY);
    });

    it('returns null when the file has no opening delimiter', () => {
        expect(splitFrontmatter('# just a heading\n\nbody text')).toBeNull();
    });

    it('returns null when the closing delimiter is missing', () => {
        expect(splitFrontmatter('---\nname: x\n\nbody, no close')).toBeNull();
    });

    it('round-trips via joinFrontmatter', () => {
        const content = buildFile();
        const split = splitFrontmatter(content)!;
        expect(joinFrontmatter(split.header, split.body)).toBe(content);
    });
});

describe('extractDigestSection', () => {
    it('reports missing when there are no markers at all', () => {
        expect(extractDigestSection(BODY)).toEqual({ kind: 'missing' });
    });

    it('extracts original body and digest text when exactly one pair is present', () => {
        const body = `${BODY}\n${DIGEST_START}\ncompressed text here\n${DIGEST_END}\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('ok');
        if (result.kind === 'ok') {
            expect(result.originalBody).toBe(BODY.trim());
            expect(result.digestText).toBe('compressed text here');
        }
    });

    it('flags duplicate START markers as malformed', () => {
        const body = `${BODY}\n${DIGEST_START}\nfirst\n${DIGEST_START}\nsecond\n${DIGEST_END}\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
        if (result.kind === 'malformed') {
            expect(result.reason).toMatch(/2 START/);
        }
    });

    it('flags duplicate END markers as malformed', () => {
        const body = `${BODY}\n${DIGEST_START}\nfirst\n${DIGEST_END}\nstray\n${DIGEST_END}\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
        if (result.kind === 'malformed') {
            expect(result.reason).toMatch(/2 END/);
        }
    });

    it('flags a START with no matching END as malformed', () => {
        const body = `${BODY}\n${DIGEST_START}\ndangling\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
    });

    it('flags an END with no matching START as malformed', () => {
        const body = `${BODY}\n${DIGEST_END}\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
    });

    it('flags END appearing before START as malformed', () => {
        const body = `${DIGEST_END}\n${BODY}\n${DIGEST_START}\n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
        if (result.kind === 'malformed') {
            expect(result.reason).toMatch(/precedes/);
        }
    });

    it('flags non-whitespace content after the END marker as malformed', () => {
        const body = `${BODY}\n${DIGEST_START}\ndigest\n${DIGEST_END}\ntrailing paragraph`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('malformed');
        if (result.kind === 'malformed') {
            expect(result.reason).toMatch(/after the END marker/);
        }
    });

    it('allows trailing whitespace-only content after END', () => {
        const body = `${BODY}\n${DIGEST_START}\ndigest\n${DIGEST_END}\n\n  \n`;
        const result = extractDigestSection(body);
        expect(result.kind).toBe('ok');
    });
});

describe('computeDigestHash', () => {
    it('is deterministic for the same input', () => {
        const a = computeDigestHash('some original body text');
        const b = computeDigestHash('some original body text');
        expect(a).toBe(b);
    });

    it('is 8 lowercase hex characters', () => {
        const hash = computeDigestHash('anything');
        expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('changes when the input changes', () => {
        const a = computeDigestHash('body version 1');
        const b = computeDigestHash('body version 2');
        expect(a).not.toBe(b);
    });
});

describe('estimateTokenCost', () => {
    it('is ceil(chars / 4)', () => {
        expect(estimateTokenCost('a'.repeat(4))).toBe(1);
        expect(estimateTokenCost('a'.repeat(5))).toBe(2);
        expect(estimateTokenCost('a'.repeat(8))).toBe(2);
        expect(estimateTokenCost('')).toBe(0);
    });
});

describe('readFrontmatterScalar / upsertFrontmatterScalar', () => {
    it('reads a top-level scalar', () => {
        expect(readFrontmatterScalar(FRONTMATTER, 'token_cost')).toBe('0');
    });

    it('returns undefined for an absent key', () => {
        expect(
            readFrontmatterScalar(FRONTMATTER, 'digest_hash')
        ).toBeUndefined();
    });

    it('does not match a same-named key nested under gating', () => {
        // `signal_kind` only exists indented under `gating:` — a bare top-level
        // read must not match it.
        expect(
            readFrontmatterScalar(FRONTMATTER, 'signal_kind')
        ).toBeUndefined();
    });

    it('strips one layer of surrounding quotes', () => {
        const header = 'digest_hash: "abcd1234"';
        expect(readFrontmatterScalar(header, 'digest_hash')).toBe('abcd1234');
    });

    it('replaces an existing key in place, leaving other lines untouched', () => {
        const updated = upsertFrontmatterScalar(
            FRONTMATTER,
            'token_cost',
            '42'
        );
        expect(updated).toContain('token_cost: 42');
        expect(updated).not.toContain('token_cost: 0');
        // Every other line survives unchanged.
        expect(updated).toContain('gating:');
        expect(updated).toContain('triggers: [rsi_oversold]');
    });

    it('appends a new key after insertAfterKey when absent', () => {
        const updated = upsertFrontmatterScalar(
            FRONTMATTER,
            'digest_hash',
            '"abcd1234"',
            'token_cost'
        );
        const lines = updated.split('\n');
        const tokenIdx = lines.findIndex(l => l.startsWith('token_cost:'));
        const hashIdx = lines.findIndex(l => l.startsWith('digest_hash:'));
        expect(hashIdx).toBe(tokenIdx + 1);
    });

    it('appends at the end when insertAfterKey is also absent', () => {
        const header = 'name: x';
        const updated = upsertFrontmatterScalar(
            header,
            'digest_hash',
            '"x"',
            'token_cost'
        );
        expect(updated).toBe('name: x\ndigest_hash: "x"');
    });
});

describe('verifyFileContent', () => {
    it('flags a file with no digest section as missing-digest', () => {
        const violations = verifyFileContent(buildFile());
        expect(violations).toEqual([
            {
                kind: 'missing-digest',
                detail: 'no PROMPT_DIGEST:START/END section found',
            },
        ]);
    });

    it('flags a malformed marker pair as malformed-markers', () => {
        const content = buildFile();
        const split = splitFrontmatter(content)!;
        const brokenBody = `${split.body}\n${DIGEST_START}\ndigest\n`; // no END
        const brokenContent = joinFrontmatter(split.header, brokenBody);
        const violations = verifyFileContent(brokenContent);
        expect(violations).toHaveLength(1);
        expect(violations[0].kind).toBe('malformed-markers');
    });

    it('passes with no violations when hash and token_cost are correct', () => {
        const digestText = 'compressed digest text';
        const originalBody = BODY.trim();
        const hash = computeDigestHash(originalBody);
        const tokens = estimateTokenCost(digestText);
        const header = `${FRONTMATTER}\ndigest_hash: "${hash}"`.replace(
            'token_cost: 0',
            `token_cost: ${tokens}`
        );
        const content = buildFile({ header, digest: digestText });
        expect(verifyFileContent(content)).toEqual([]);
    });

    it('flags a stale digest_hash', () => {
        const digestText = 'compressed digest text';
        const tokens = estimateTokenCost(digestText);
        const header = `${FRONTMATTER}\ndigest_hash: "deadbeef"`.replace(
            'token_cost: 0',
            `token_cost: ${tokens}`
        );
        const content = buildFile({ header, digest: digestText });
        const violations = verifyFileContent(content);
        expect(violations).toHaveLength(1);
        expect(violations[0].kind).toBe('hash-mismatch');
    });

    it('flags a stale token_cost', () => {
        const digestText = 'compressed digest text';
        const originalBody = BODY.trim();
        const hash = computeDigestHash(originalBody);
        const header = `${FRONTMATTER}\ndigest_hash: "${hash}"`; // token_cost stays 0
        const content = buildFile({ header, digest: digestText });
        const violations = verifyFileContent(content);
        expect(violations).toHaveLength(1);
        expect(violations[0].kind).toBe('token-cost-mismatch');
    });

    it('flags invalid-frontmatter when there is no --- block', () => {
        const violations = verifyFileContent('no frontmatter here at all');
        expect(violations).toEqual([
            {
                kind: 'invalid-frontmatter',
                detail: 'could not locate a --- frontmatter block',
            },
        ]);
    });
});

describe('updateFileContent', () => {
    it('skips a file with no digest section', () => {
        const result = updateFileContent(buildFile());
        expect(result.changed).toBe(false);
        expect(result.skippedReason).toBe('missing-digest');
    });

    it('skips a malformed file', () => {
        const content = buildFile();
        const split = splitFrontmatter(content)!;
        const brokenContent = joinFrontmatter(
            split.header,
            `${split.body}\n${DIGEST_START}\ndigest\n`
        );
        const result = updateFileContent(brokenContent);
        expect(result.changed).toBe(false);
        expect(result.skippedReason).toBe('malformed-markers');
    });

    it('computes and writes digest_hash + token_cost for a fresh digest', () => {
        const digestText = 'a fresh compressed digest';
        const content = buildFile({ digest: digestText });
        const result = updateFileContent(content);
        expect(result.changed).toBe(true);

        const newSplit = splitFrontmatter(result.content)!;
        const expectedHash = computeDigestHash(BODY.trim());
        const expectedTokens = estimateTokenCost(digestText);
        expect(readFrontmatterScalar(newSplit.header, 'digest_hash')).toBe(
            expectedHash
        );
        expect(readFrontmatterScalar(newSplit.header, 'token_cost')).toBe(
            String(expectedTokens)
        );
        // gating block untouched.
        expect(newSplit.header).toContain('triggers: [rsi_oversold]');
    });

    it('is idempotent: a second run produces zero changes', () => {
        const digestText = 'a fresh compressed digest';
        const content = buildFile({ digest: digestText });
        const first = updateFileContent(content);
        expect(first.changed).toBe(true);

        const second = updateFileContent(first.content);
        expect(second.changed).toBe(false);
        expect(second.content).toBe(first.content);
    });

    it('is idempotent against a real temp fixture file on disk', () => {
        const dir = mkdtempSync(join(tmpdir(), 'skills-digest-test-'));
        const file = join(dir, 'fixture.md');
        try {
            const digestText = 'digest text for the on-disk fixture';
            writeFileSync(file, buildFile({ digest: digestText }));

            const firstResult = updateFileContent(readFileSync(file, 'utf-8'));
            expect(firstResult.changed).toBe(true);
            writeFileSync(file, firstResult.content);

            // verify now reports clean.
            expect(verifyFileContent(readFileSync(file, 'utf-8'))).toEqual([]);

            const secondResult = updateFileContent(readFileSync(file, 'utf-8'));
            expect(secondResult.changed).toBe(false);
            writeFileSync(file, secondResult.content);

            const thirdResult = updateFileContent(readFileSync(file, 'utf-8'));
            expect(thirdResult.changed).toBe(false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
