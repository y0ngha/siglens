/**
 * Skill PROMPT_DIGEST metadata tooling.
 *
 * Every `skills/**\/*.md` file may carry a `PROMPT_DIGEST` section — a
 * compressed, prompt-facing rewrite of the skill's body, delimited by:
 *
 *   <!-- PROMPT_DIGEST:START -->
 *   ...digest text...
 *   <!-- PROMPT_DIGEST:END -->
 *
 * placed once, at the end of the file, after the original (frontmatter) body.
 * The digest text itself is authored by hand — this script never writes it.
 * What this script owns is the two frontmatter keys that describe it:
 *
 *   - `digest_hash`  — first 8 hex chars of SHA-256(original body). A
 *     staleness fingerprint: if the original body changes but the digest
 *     doesn't get re-authored against it, the hash goes stale and `verify`
 *     catches it.
 *   - `token_cost`   — Math.ceil(digestText.length / 4), an estimate of the
 *     digest's prompt-token footprint.
 *
 * Modes:
 *   - `verify`      — read-only. Reports every file missing a digest, with a
 *     stale hash, a stale token_cost, or malformed/duplicate markers. Exits
 *     1 if any violation is found (wired into CI once digests are authored).
 *   - `update-meta` — recomputes `digest_hash` + `token_cost` for every file
 *     that HAS a digest section and rewrites just those two frontmatter
 *     lines in place (line-based edit — the rest of the frontmatter, gating
 *     blocks included, is left byte-for-byte untouched). Idempotent: running
 *     it twice in a row makes zero changes the second time.
 *
 * Run via `yarn skills:digest-verify` / `yarn skills:digest-update`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');

export const DIGEST_START = '<!-- PROMPT_DIGEST:START -->';
export const DIGEST_END = '<!-- PROMPT_DIGEST:END -->';

// ---------------------------------------------------------------------------
// Frontmatter split (line-based, not a full YAML round-trip)
// ---------------------------------------------------------------------------

export interface FrontmatterSplit {
    /** Raw text between the two `---` delimiter lines (delimiters excluded). */
    header: string;
    /** Everything after the closing `---` line, including its leading newline. */
    body: string;
}

/**
 * Split a skill file into its frontmatter header and body. Returns `null`
 * when the file doesn't start with a `---` delimiter or never closes one —
 * callers treat that as "not a valid frontmatter file" rather than crashing.
 *
 * Deliberately line-based rather than a YAML parse: we only ever need to
 * read/replace two top-level scalar keys, and reserializing the whole
 * frontmatter via a YAML library would reformat `gating` blocks the skills
 * team hand-tunes (quoting style, list style, comments) — churn with no
 * benefit. See scripts/validate-skills.ts for the read-only YAML parse path
 * used by the separate gating validator.
 */
export function splitFrontmatter(content: string): FrontmatterSplit | null {
    // Normalize CRLF -> LF before splitting: this is the single read/parse
    // entry point every caller (verify, update-meta, and their unit tests)
    // funnels through, so normalizing here makes digest_hash/token_cost
    // platform-stable regardless of the source file's line endings. A no-op
    // for LF-only content, so existing hashes are unaffected.
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    if (lines[0]?.trim() !== '---') return null;

    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === '---') {
            endIdx = i;
            break;
        }
    }
    if (endIdx === -1) return null;

    return {
        header: lines.slice(1, endIdx).join('\n'),
        body: lines.slice(endIdx + 1).join('\n'),
    };
}

/** Inverse of `splitFrontmatter` — reassembles a full file from its parts. */
export function joinFrontmatter(header: string, body: string): string {
    return ['---', header, '---', body].join('\n');
}

// ---------------------------------------------------------------------------
// Digest section extraction (pure — operates on the post-frontmatter body)
// ---------------------------------------------------------------------------

export type DigestSectionResult =
    | { kind: 'missing' }
    | { kind: 'malformed'; reason: string }
    | { kind: 'ok'; originalBody: string; digestText: string };

const countOccurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1;

/**
 * Locate the (at most one) PROMPT_DIGEST section inside a skill's body.
 *
 * - No markers at all → `missing` (the common/expected state today — no real
 *   skill file has a digest yet).
 * - Anything other than exactly one START and one END, START before END, with
 *   only whitespace after END → `malformed` (covers duplicated markers,
 *   START without a matching END, END without START, END-before-START, and
 *   trailing content after the section).
 * - Otherwise → `ok`, with the original body (before START, trimmed) and the
 *   digest text (between the markers, trimmed).
 */
export function extractDigestSection(body: string): DigestSectionResult {
    const startCount = countOccurrences(body, DIGEST_START);
    const endCount = countOccurrences(body, DIGEST_END);

    if (startCount === 0 && endCount === 0) {
        return { kind: 'missing' };
    }
    if (startCount !== 1 || endCount !== 1) {
        return {
            kind: 'malformed',
            reason: `expected exactly one START/END marker pair, found ${startCount} START and ${endCount} END`,
        };
    }

    const startIdx = body.indexOf(DIGEST_START);
    const endIdx = body.indexOf(DIGEST_END);
    if (endIdx < startIdx) {
        return {
            kind: 'malformed',
            reason: 'END marker precedes START marker',
        };
    }

    const trailing = body.slice(endIdx + DIGEST_END.length);
    if (trailing.trim().length > 0) {
        return {
            kind: 'malformed',
            reason: 'non-whitespace content found after the END marker (digest section must be last)',
        };
    }

    return {
        kind: 'ok',
        originalBody: body.slice(0, startIdx).trim(),
        digestText: body.slice(startIdx + DIGEST_START.length, endIdx).trim(),
    };
}

// ---------------------------------------------------------------------------
// Hash / token estimation
// ---------------------------------------------------------------------------

/** First 8 hex chars of SHA-256(originalBody) — the staleness fingerprint. */
export function computeDigestHash(originalBody: string): string {
    return createHash('sha256')
        .update(originalBody, 'utf8')
        .digest('hex')
        .slice(0, 8);
}

/** Estimated prompt-token footprint of the digest text. */
export function estimateTokenCost(digestText: string): number {
    return Math.ceil(digestText.length / 4);
}

// ---------------------------------------------------------------------------
// Frontmatter scalar read/write (top-level keys only, line-based)
// ---------------------------------------------------------------------------

/** Strip one layer of matching single/double quotes, if present. */
const unquote = (value: string): string => {
    if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

/**
 * Read a top-level scalar key from the frontmatter header (e.g. `token_cost`
 * or `digest_hash`). Anchored with no leading indentation, so it never
 * matches a same-named key nested inside `gating:` (those lines are indented
 * and therefore don't start with the bare key literal). Returns the raw
 * value with one layer of quoting stripped, or `undefined` if the key is
 * absent.
 */
export function readFrontmatterScalar(
    header: string,
    key: string
): string | undefined {
    const match = header.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
    if (!match) return undefined;
    return unquote(match[1]?.trim() ?? '');
}

/**
 * Set a top-level scalar key's value, in place, without touching any other
 * line. If the key already exists, only its line is rewritten. If absent,
 * a new `key: value` line is appended immediately after `insertAfterKey`'s
 * line (falling back to the end of the header when that key is also
 * missing) — every other line, and the order of every other key, is
 * untouched.
 */
export function upsertFrontmatterScalar(
    header: string,
    key: string,
    rawValue: string,
    insertAfterKey?: string
): string {
    const lineRe = new RegExp(`^${key}:.*$`, 'm');
    if (lineRe.test(header)) {
        return header.replace(lineRe, `${key}: ${rawValue}`);
    }

    const newLine = `${key}: ${rawValue}`;
    if (insertAfterKey) {
        const afterRe = new RegExp(`^(${insertAfterKey}:.*)$`, 'm');
        if (afterRe.test(header)) {
            return header.replace(afterRe, `$1\n${newLine}`);
        }
    }
    return `${header}\n${newLine}`;
}

// ---------------------------------------------------------------------------
// verify — pure, file-content-in / violations-out
// ---------------------------------------------------------------------------

export type ViolationKind =
    | 'invalid-frontmatter'
    | 'missing-digest'
    | 'malformed-markers'
    | 'hash-mismatch'
    | 'token-cost-mismatch';

export interface Violation {
    kind: ViolationKind;
    detail: string;
}

/** Verify a single file's content. Pure — no fs access, easy to unit test. */
export function verifyFileContent(content: string): Violation[] {
    const split = splitFrontmatter(content);
    if (!split) {
        return [
            {
                kind: 'invalid-frontmatter',
                detail: 'could not locate a --- frontmatter block',
            },
        ];
    }

    const section = extractDigestSection(split.body);
    if (section.kind === 'missing') {
        return [
            {
                kind: 'missing-digest',
                detail: 'no PROMPT_DIGEST:START/END section found',
            },
        ];
    }
    if (section.kind === 'malformed') {
        return [{ kind: 'malformed-markers', detail: section.reason }];
    }

    const violations: Violation[] = [];

    const computedHash = computeDigestHash(section.originalBody);
    const frontmatterHash = readFrontmatterScalar(split.header, 'digest_hash');
    if (frontmatterHash !== computedHash) {
        violations.push({
            kind: 'hash-mismatch',
            detail: `frontmatter digest_hash=${frontmatterHash ?? '(missing)'} != computed=${computedHash}`,
        });
    }

    const computedTokens = estimateTokenCost(section.digestText);
    const frontmatterTokenRaw = readFrontmatterScalar(
        split.header,
        'token_cost'
    );
    const frontmatterTokens =
        frontmatterTokenRaw !== undefined && frontmatterTokenRaw !== ''
            ? Number(frontmatterTokenRaw)
            : undefined;
    if (
        frontmatterTokens === undefined ||
        Number.isNaN(frontmatterTokens) ||
        frontmatterTokens !== computedTokens
    ) {
        violations.push({
            kind: 'token-cost-mismatch',
            detail: `frontmatter token_cost=${frontmatterTokenRaw ?? '(missing)'} != computed=${computedTokens}`,
        });
    }

    return violations;
}

// ---------------------------------------------------------------------------
// update-meta — pure, file-content-in / new-content-out
// ---------------------------------------------------------------------------

export type SkipReason =
    | 'invalid-frontmatter'
    | 'missing-digest'
    | 'malformed-markers';

export interface UpdateResult {
    changed: boolean;
    skippedReason?: SkipReason;
    /** New file content. Equal to the input when `changed` is false. */
    content: string;
}

/**
 * Recompute `digest_hash` + `token_cost` for a single file's content and
 * return the rewritten content. Only files with an `ok` digest section are
 * touched — files with no digest, or a malformed one, are left completely
 * alone (that's `verify`'s job to flag, not this mode's to "fix").
 */
export function updateFileContent(content: string): UpdateResult {
    const split = splitFrontmatter(content);
    if (!split) {
        return {
            changed: false,
            skippedReason: 'invalid-frontmatter',
            content,
        };
    }

    const section = extractDigestSection(split.body);
    if (section.kind === 'missing') {
        return { changed: false, skippedReason: 'missing-digest', content };
    }
    if (section.kind === 'malformed') {
        return { changed: false, skippedReason: 'malformed-markers', content };
    }

    const computedHash = computeDigestHash(section.originalBody);
    const computedTokens = estimateTokenCost(section.digestText);

    const currentHash = readFrontmatterScalar(split.header, 'digest_hash');
    const currentTokensRaw = readFrontmatterScalar(split.header, 'token_cost');
    const currentTokens =
        currentTokensRaw !== undefined && currentTokensRaw !== ''
            ? Number(currentTokensRaw)
            : undefined;

    if (currentHash === computedHash && currentTokens === computedTokens) {
        return { changed: false, content };
    }

    // digest_hash is written quoted: an 8-hex-char string has a real chance of
    // being all-digit (~3.6% of the keyspace), which a YAML parser would
    // otherwise read back as a number and silently drop leading zeros from.
    let newHeader = upsertFrontmatterScalar(
        split.header,
        'token_cost',
        String(computedTokens)
    );
    newHeader = upsertFrontmatterScalar(
        newHeader,
        'digest_hash',
        `"${computedHash}"`,
        'token_cost'
    );

    return { changed: true, content: joinFrontmatter(newHeader, split.body) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function listSkillFiles(): Promise<string[]> {
    const allFiles = await glob('**/*.md', { cwd: SKILLS_DIR, absolute: true });
    // `.sort()` not `.toSorted()`: scripts/ isn't covered by the main tsconfig's
    // esnext lib, so Array.prototype.toSorted isn't available.
    return [...allFiles]
        .filter(file => relative(SKILLS_DIR, file) !== 'CLAUDE.md')
        .sort();
}

function runVerify(files: string[]): void {
    const rows = files.flatMap(file => {
        const content = readFileSync(file, 'utf-8');
        const rel = relative(REPO_ROOT, file);
        return verifyFileContent(content).map(violation => ({
            file: rel,
            violation,
        }));
    });

    if (rows.length > 0) {
        console.error(
            `\n✖ Skill digest verification failed (${rows.length} violation${rows.length === 1 ? '' : 's'} across ${new Set(rows.map(r => r.file)).size} file(s)):\n`
        );
        for (const { file, violation } of rows) {
            console.error(`  ${file}`);
            console.error(`    [${violation.kind}] ${violation.detail}`);
        }
        console.error('');
        process.exit(1);
    }

    console.log(`✓ ${files.length} skill file(s) have valid digest metadata.`);
}

function runUpdateMeta(files: string[]): void {
    let updated = 0;
    let unchanged = 0;
    let skippedMissing = 0;
    let skippedMalformed = 0;
    let skippedInvalid = 0;

    for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const result = updateFileContent(content);
        const rel = relative(REPO_ROOT, file);

        switch (result.skippedReason) {
            case 'missing-digest':
                skippedMissing++;
                continue;
            case 'malformed-markers':
                skippedMalformed++;
                console.error(`  ! ${rel}: malformed digest markers, skipped`);
                continue;
            case 'invalid-frontmatter':
                skippedInvalid++;
                console.error(`  ! ${rel}: no frontmatter block, skipped`);
                continue;
            default:
                break;
        }

        if (result.changed) {
            writeFileSync(file, result.content);
            updated++;
        } else {
            unchanged++;
        }
    }

    console.log(
        `✓ update-meta: ${updated} updated, ${unchanged} unchanged, ` +
            `${skippedMissing} skipped (no digest), ${skippedMalformed} skipped (malformed), ` +
            `${skippedInvalid} skipped (invalid frontmatter).`
    );
}

const USAGE = 'usage: tsx scripts/skills-digest.ts <verify|update-meta>';

async function main(): Promise<void> {
    const mode = process.argv[2];
    if (mode !== 'verify' && mode !== 'update-meta') {
        console.error(USAGE);
        process.exit(2);
    }

    const files = await listSkillFiles();
    if (mode === 'verify') {
        runVerify(files);
    } else {
        runUpdateMeta(files);
    }
}

// Run the CLI only when executed directly (`tsx scripts/skills-digest.ts`),
// not when imported by the unit test, which exercises the pure helpers.
const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    main().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`✖ skills-digest crashed: ${reason}`);
        process.exit(1);
    });
}
