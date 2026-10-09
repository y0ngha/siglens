import path from 'path';
import { sql } from 'drizzle-orm';
import { endDatabaseClient, getDatabaseClient } from '@/shared/db/client';
import { readDatabaseConfig } from '@/shared/db/config';
import { guideEntries, guideEntryContents } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { guardRemoteWrite } from './lib/dbTarget';
import {
    loadGuideSeed,
    planGuideUpsert,
    type ExistingGuideContent,
    type ExistingGuideEntry,
} from './lib/guideSeed';

export const GUIDE_SEEDS_ROOT = path.resolve(__dirname, '../seeds/guide');

export interface SeedGuideResult {
    readonly entriesUpserted: number;
    readonly contentsUpserted: number;
    readonly warnings: readonly string[];
}

/**
 * 가이드 시드를 `db`에 적재한다 — 바뀐 행만 upsert하고, 지우지는 않는다.
 *
 * 항목 행이 먼저여야 한다(본문 행이 FK로 가리킨다). 바뀐 행은 `updated_at`을 now()로
 * 올려 JSON-LD `dateModified`·사이트맵 lastmod가 실제 수정 시점을 따르게 한다.
 * 시드에 없는 DB 행은 운영 데이터 보호를 위해 삭제하지 않고 경고로만 알린다.
 * E2E 시드(`e2e/setup/seed.ts`)도 같은 함수를 부른다.
 */
export async function seedGuide(
    db: SiglensDatabase,
    seedsRoot: string = GUIDE_SEEDS_ROOT
): Promise<SeedGuideResult> {
    const seed = await loadGuideSeed(seedsRoot);

    const existingEntries: ExistingGuideEntry[] = await db
        .select({
            slug: guideEntries.slug,
            category: guideEntries.category,
            sortOrder: guideEntries.sortOrder,
            related: guideEntries.related,
            skills: guideEntries.skills,
        })
        .from(guideEntries);
    const existingContents: ExistingGuideContent[] = await db
        .select({
            slug: guideEntryContents.slug,
            locale: guideEntryContents.locale,
            contentHash: guideEntryContents.contentHash,
        })
        .from(guideEntryContents);

    const plan = planGuideUpsert(seed, existingEntries, existingContents);
    const warnings = [
        ...seed.warnings,
        ...plan.orphans.map(
            orphan => `DB에만 있는 행(삭제하지 않음): ${orphan}`
        ),
    ];

    if (plan.entries.length > 0) {
        await db
            .insert(guideEntries)
            .values(
                plan.entries.map(entry => ({
                    slug: entry.slug,
                    category: entry.category,
                    sortOrder: entry.order,
                    related: [...entry.related],
                    skills: [...entry.skills],
                }))
            )
            .onConflictDoUpdate({
                target: guideEntries.slug,
                set: {
                    category: sql`excluded.category`,
                    sortOrder: sql`excluded.sort_order`,
                    related: sql`excluded.related`,
                    skills: sql`excluded.skills`,
                    updatedAt: sql`now()`,
                },
            });
    }

    if (plan.contents.length > 0) {
        await db
            .insert(guideEntryContents)
            .values(
                plan.contents.map(content => ({
                    slug: content.slug,
                    locale: content.locale,
                    title: content.title,
                    aliases: [...content.aliases],
                    summary: content.summary,
                    seoTitle: content.seoTitle,
                    seoDescription: content.seoDescription,
                    demoCaption: content.demoCaption,
                    bodyMd: content.bodyMd,
                    faq: [...content.faq],
                    contentHash: content.contentHash,
                }))
            )
            .onConflictDoUpdate({
                target: [guideEntryContents.slug, guideEntryContents.locale],
                set: {
                    title: sql`excluded.title`,
                    aliases: sql`excluded.aliases`,
                    summary: sql`excluded.summary`,
                    seoTitle: sql`excluded.seo_title`,
                    seoDescription: sql`excluded.seo_description`,
                    demoCaption: sql`excluded.demo_caption`,
                    bodyMd: sql`excluded.body_md`,
                    faq: sql`excluded.faq`,
                    contentHash: sql`excluded.content_hash`,
                    updatedAt: sql`now()`,
                },
            });
    }

    return {
        entriesUpserted: plan.entries.length,
        contentsUpserted: plan.contents.length,
        warnings,
    };
}

async function main(): Promise<void> {
    // 앱 클라이언트는 DIRECT_DATABASE_URL이 아니라 DATABASE_URL만 읽는다 — 가드도 같은 값을 본다.
    guardRemoteWrite(readDatabaseConfig().databaseUrl, 'seed:guide');
    const { db } = getDatabaseClient();
    const result = await seedGuide(db);
    for (const warning of result.warnings) {
        console.warn(`[seed:guide] 경고: ${warning}`);
    }
    console.log(
        `[seed:guide] entries ${result.entriesUpserted}건, contents ${result.contentsUpserted}건 upsert`
    );
}

if (require.main === module) {
    main()
        .catch(err => {
            console.error('[seed:guide] failed:', err);
            process.exitCode = 1;
        })
        // 풀을 닫지 않으면 유휴 소켓(idle_timeout 20s)이 프로세스를 그만큼 붙잡는다.
        .finally(() => endDatabaseClient());
}
