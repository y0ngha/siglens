import path from 'path';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import { z } from 'zod';
import { TERMS_KIND_VALUES, type TermsKind } from '@/shared/db/constants';
import { DrizzleTermsRepository } from '@/entities/terms';
import { getDatabaseClient } from '@/shared/db/client';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';

const FrontmatterSchema = z.object({
    kind: z.enum(TERMS_KIND_VALUES),
    version: z.number().int().positive(),
    /**
     * 생략하거나 `ko`면 원문 시드다. 나머지는 그 로케일의 **인간 번역**이며
     * `content_translations`에 `source='human'`으로 들어간다.
     *
     * 파일명이 아니라 frontmatter에서 읽는다. 파일명 파싱은 오타가 나면 그
     * 파일이 조용히 무시되고, 화면은 폴백 배너로 멀쩡해 보인다.
     */
    locale: z.enum(LOCALES).optional(),
    /** 원문 시드에만 필요하다. 번역은 원문의 발효일을 그대로 따른다. */
    effectiveDate: z
        .union([z.string(), z.date()])
        .optional()
        .transform(value => {
            if (value === undefined) return undefined;
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
    /** 번역 시드면 그 로케일, 원문 시드면 `undefined`. */
    locale?: Exclude<Locale, typeof DEFAULT_LOCALE>;
    /** 원문 시드에만 있다. */
    effectiveDate?: Date;
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

    const isTranslation =
        result.data.locale !== undefined &&
        result.data.locale !== DEFAULT_LOCALE;

    if (!isTranslation && result.data.effectiveDate === undefined) {
        throw new Error(
            `Invalid frontmatter in ${filePath} — 원문 시드에는 effectiveDate가 필요하다`
        );
    }

    return {
        kind: result.data.kind,
        version: result.data.version,
        locale: isTranslation
            ? (result.data.locale as Exclude<Locale, typeof DEFAULT_LOCALE>)
            : undefined,
        effectiveDate: result.data.effectiveDate,
        body: parsed.content.trim(),
        sourceFile: filePath,
    };
}

/** Validate version monotonicity, detect duplicates / gaps, and orphan translations. */
export function validateSeedFiles(seeds: readonly ParsedSeed[]): void {
    const originals = seeds.filter(seed => seed.locale === undefined);
    const byKind = new Map<string, number[]>();
    for (const seed of originals) {
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

    // 버전 오타 하나가 아무도 읽지 않는 고아 번역 행을 조용히 만드는 것을 막는다.
    const originalKeys = new Set(
        originals.map(seed => `${seed.kind}:${seed.version}`)
    );
    for (const seed of seeds) {
        if (seed.locale === undefined) continue;
        if (!originalKeys.has(`${seed.kind}:${seed.version}`)) {
            throw new Error(
                `orphan translation: ${seed.kind} v${seed.version} ${seed.locale} has no original seed (${seed.sourceFile})`
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

    const originals = seeds.filter(seed => seed.locale === undefined);
    const translations = seeds.filter(seed => seed.locale !== undefined);

    // 번역은 원문 행의 uuid를 `entityId`로 쓰므로 원문을 먼저 적재해야 한다.
    const idByKey = new Map<string, string>();
    for (const seed of originals) {
        const id = await repo.upsertFromSeed({
            kind: seed.kind,
            version: seed.version,
            // parseSeedFile이 원문에 발효일이 있음을 보장한다.
            effectiveDate: seed.effectiveDate!,
            body: seed.body,
        });
        idByKey.set(`${seed.kind}:${seed.version}`, id);
        console.log(`[seed] ${seed.kind} v${seed.version}: upserted`);
    }

    await Promise.all(
        translations.map(async seed => {
            const termsId = idByKey.get(`${seed.kind}:${seed.version}`);
            // validateSeedFiles가 고아 번역을 이미 막았다.
            if (termsId === undefined) return;
            await repo.upsertTranslation({
                termsId,
                locale: seed.locale!,
                body: seed.body,
            });
            console.log(
                `[seed] ${seed.kind} v${seed.version} ${seed.locale}: translation upserted`
            );
        })
    );
}

if (require.main === module) {
    main().catch(err => {
        console.error('[seed] failed:', err);
        process.exit(1);
    });
}
