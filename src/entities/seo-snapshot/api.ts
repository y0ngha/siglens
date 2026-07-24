import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
    SeoSnapshotUpsertInput,
} from './model';

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

    async findBySymbol(symbol: string): Promise<SeoAnalysisSnapshot[]> {
        const rows = await this.db
            .select()
            .from(seoAnalysisSnapshots)
            .where(eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()));

        return rows as SeoAnalysisSnapshot[];
    }

    async findBySymbolAndTab(
        symbol: string,
        tab: SeoSnapshotTab
    ): Promise<SeoAnalysisSnapshot | null> {
        const rows = await this.db
            .select()
            .from(seoAnalysisSnapshots)
            .where(
                and(
                    eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()),
                    eq(seoAnalysisSnapshots.tab, tab)
                )
            );

        return (rows[0] as SeoAnalysisSnapshot | undefined) ?? null;
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
