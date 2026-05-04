import path from 'path';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import { z } from 'zod';
import {
    TERMS_KIND_VALUES,
    type TermsKind,
} from '../../src/infrastructure/db/constants';
import { DrizzleTermsRepository } from '../../src/infrastructure/db/termsRepository';
import { getDatabaseClient } from '../../src/infrastructure/db/client';

const FrontmatterSchema = z.object({
    kind: z.enum(TERMS_KIND_VALUES),
    version: z.number().int().positive(),
    effectiveDate: z.union([z.string(), z.date()]).transform(value => {
        const date = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(date.getTime())) {
            throw new Error('Invalid effectiveDate');
        }
        return date;
    }),
});

export interface ParsedSeed {
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
    sourceFile: string;
}

/** Parse a single seed markdown file into a ParsedSeed. */
export function parseSeedFile(filePath: string): ParsedSeed {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const result = FrontmatterSchema.safeParse(parsed.data);
    if (!result.success) {
        const issues = result.error.issues
            .map(i => `${i.path.join('.')}: ${i.message}`)
            .join(', ');
        throw new Error(`Invalid frontmatter in ${filePath} — ${issues}`);
    }
    return {
        kind: result.data.kind,
        version: result.data.version,
        effectiveDate: result.data.effectiveDate,
        body: parsed.content.trim(),
        sourceFile: filePath,
    };
}

/** Validate version monotonicity and detect duplicates / gaps. */
export function validateSeedFiles(seeds: readonly ParsedSeed[]): void {
    const byKind = new Map<string, number[]>();
    for (const seed of seeds) {
        const list = byKind.get(seed.kind) ?? [];
        if (list.includes(seed.version)) {
            throw new Error(
                `duplicate seed for ${seed.kind} v${seed.version} (${seed.sourceFile})`
            );
        }
        byKind.set(seed.kind, [...list, seed.version]);
    }
    for (const [kind, versions] of byKind) {
        const sorted = versions.toSorted((a, b) => a - b);
        const gapIdx = sorted.findIndex((v, i) => v !== i + 1);
        if (gapIdx !== -1) {
            throw new Error(
                `version gap detected for kind=${kind}: expected ${gapIdx + 1}, got ${sorted[gapIdx]}`
            );
        }
    }
}

async function main(): Promise<void> {
    const seedsRoot = path.resolve(__dirname, '../seeds/terms');
    const files = await glob('**/*.md', { cwd: seedsRoot, absolute: true });
    if (files.length === 0) {
        console.warn('[seed] no terms seed files found at', seedsRoot);
        return;
    }

    const seeds = files.map(parseSeedFile);
    validateSeedFiles(seeds);

    const { db } = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);

    await Promise.all(
        seeds.map(async seed => {
            await repo.upsertFromSeed({
                kind: seed.kind,
                version: seed.version,
                effectiveDate: seed.effectiveDate,
                body: seed.body,
            });
            console.log(`[seed] ${seed.kind} v${seed.version}: upserted`);
        })
    );
}

main().catch(err => {
    console.error('[seed] failed:', err);
    process.exit(1);
});
