/**
 * Content-consistency test for skills/_core/pattern-index.md.
 *
 * This file is the always-on chart-pattern coverage index (commits c6dea2ea,
 * 5be1e11d) — every one of the 17 `PATTERN_TRIGGER_CATALOG` chart-pattern
 * pre-screener ids (the same catalog validate-skills.ts cross-checks
 * `type: pattern` skill triggers against) must have a one-line entry here
 * carrying both a measured-move Target and an invalidation/stop hint, so the
 * model can still name a visible pattern even when its detailed skill wasn't
 * gated in this run. Before this test, pattern-index.md had zero automated
 * assertions — a future catalog addition (or an edit that dropped a Target/
 * invalidation phrase) would silently ship un-caught.
 *
 * The bullet format below was read directly off the real file, not guessed:
 *   - **{id}:** ... Target: ...; invalidated by ...
 *   - **{id} (alias):** ... Target: ...; stop = ...
 * (`ascending_wedge (rising wedge)` / `descending_wedge (falling wedge)` are
 * the only entries with a parenthetical alias before the closing `:**`.) The
 * digest section at the bottom of the file (between PROMPT_DIGEST:START/END)
 * mirrors the same content in a compressed, non-bold format and is
 * deliberately NOT asserted on here — its hash/token-cost fidelity to the
 * body is already covered by `yarn skills:digest-verify` (scripts/skills-digest.ts),
 * which this repo's CI now also runs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PATTERN_TRIGGER_CATALOG } from '../validate-skills';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PATTERN_INDEX_PATH = join(
    SCRIPT_DIR,
    '..',
    '..',
    'skills',
    '_core',
    'pattern-index.md'
);

const content = readFileSync(PATTERN_INDEX_PATH, 'utf-8');

/** The single-line bullet for a given pattern id, e.g. `- **double_top:** ...`. */
const bulletRegex = (id: string): RegExp =>
    new RegExp(`^- \\*\\*${id}(?: \\([^)]*\\))?:\\*\\*(.*)$`, 'm');

/**
 * Every `- **...:**` bullet line in the file, regardless of which pattern id
 * it names. Only the main (bold) body section uses this `- **id:**` format —
 * the compressed digest section below the PROMPT_DIGEST markers uses a plain
 * `- id:` format with no bold markers, so this does not double-count digest
 * lines.
 */
const ALL_BULLETS_RE = /^- \*\*[a-z_]+(?: \([^)]*\))?:\*\*/gm;

describe('skills/_core/pattern-index.md content consistency', () => {
    it('PATTERN_TRIGGER_CATALOG has the expected 17 patterns', () => {
        expect(PATTERN_TRIGGER_CATALOG.length).toBe(17);
    });

    it('carries a bullet entry for every PATTERN_TRIGGER_CATALOG id', () => {
        for (const id of PATTERN_TRIGGER_CATALOG) {
            expect(bulletRegex(id).test(content)).toBe(true);
        }
    });

    it('has exactly as many pattern bullets as the catalog (catches undeclared/orphan entries)', () => {
        const bullets = content.match(ALL_BULLETS_RE) ?? [];
        expect(bullets).toHaveLength(PATTERN_TRIGGER_CATALOG.length);
    });

    describe.each(PATTERN_TRIGGER_CATALOG)('%s entry', id => {
        it('states a measured-move Target', () => {
            const match = bulletRegex(id).exec(content);
            expect(match).not.toBeNull();
            expect(match?.[1]).toMatch(/Target:/);
        });

        it('states an invalidation/stop hint', () => {
            const match = bulletRegex(id).exec(content);
            expect(match).not.toBeNull();
            expect(match?.[1]).toMatch(/invalidated by|stop =/);
        });
    });
});
