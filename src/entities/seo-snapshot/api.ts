import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { SeoAnalysisSnapshot, SeoSnapshotUpsertInput } from './model';

/**
 * Drizzle ORM implementation backed by Neon PostgreSQL. One row per
 * (symbol, tab); `upsert` relies on the `seo_analysis_snapshots_symbol_tab_uq`
 * unique index so repeat pre-warm cron runs overwrite the last-known-good
 * row instead of accumulating duplicates.
 */
export class DrizzleSeoSnapshotRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async upsert(input: SeoSnapshotUpsertInput): Promise<void> {
        const symbol = input.symbol.toUpperCase();

        await this.db
            .insert(seoAnalysisSnapshots)
            .values({
                symbol,
                tab: input.tab,
                content: input.content,
                model: input.model,
                generatedAt: input.generatedAt,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [seoAnalysisSnapshots.symbol, seoAnalysisSnapshots.tab],
                set: {
                    content: input.content,
                    model: input.model,
                    generatedAt: input.generatedAt,
                    updatedAt: new Date(),
                },
            });
    }

    /**
     * Consumed by `getSeoSnapshotsStatic` (entities/seo-snapshot/lib/getSnapshotStatic.ts)
     * — the read path all 7 tab pages + `generateMetadata` use to surface
     * pre-warmed snapshots. Do not remove as YAGNI without checking that caller first.
     */
    async findBySymbol(symbol: string): Promise<SeoAnalysisSnapshot[]> {
        const rows = await this.db
            .select()
            .from(seoAnalysisSnapshots)
            .where(eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()));

        return rows as SeoAnalysisSnapshot[];
    }

    async findGeneratedAtMap(symbols: string[]): Promise<Map<string, Date>> {
        if (symbols.length === 0) {
            return new Map();
        }

        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                generatedAt: seoAnalysisSnapshots.generatedAt,
            })
            .from(seoAnalysisSnapshots)
            .where(
                inArray(
                    seoAnalysisSnapshots.symbol,
                    symbols.map(symbol => symbol.toUpperCase())
                )
            );

        return new Map(
            rows.map(row => [`${row.symbol}:${row.tab}`, row.generatedAt])
        );
    }
}
