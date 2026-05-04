import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { terms } from '@/infrastructure/db/schema';
import type { TermsKind } from '@/infrastructure/db/constants';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/** Public-facing record returned by the repository. */
export interface TermsRecord {
    id: string;
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

/** Input used by the seed script to upsert a versioned terms row. */
export interface TermsSeedInput {
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

/** Repository for versioned legal terms documents. */
export interface TermsRepository {
    /** Return the active version for the given kind, or null if none. */
    findActive(kind: TermsKind): Promise<TermsRecord | null>;
    /** Insert a versioned row; no-op on (kind, version) conflict. */
    upsertFromSeed(input: TermsSeedInput): Promise<void>;
}

/** Drizzle ORM-backed implementation. */
export class DrizzleTermsRepository implements TermsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(kind: TermsKind): Promise<TermsRecord | null> {
        const rows = await this.db
            .select({
                id: terms.id,
                kind: terms.kind,
                version: terms.version,
                effectiveDate: terms.effectiveDate,
                body: terms.body,
            })
            .from(terms)
            .where(
                and(eq(terms.kind, kind), lte(terms.effectiveDate, sql`NOW()`))
            )
            .orderBy(desc(terms.effectiveDate))
            .limit(1);

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            id: row.id,
            // Safe: pgEnum('terms_kind', TERMS_KIND_VALUES) constrains the DB column to TermsKind values.
            kind: row.kind as TermsKind,
            version: row.version,
            effectiveDate: row.effectiveDate,
            body: row.body,
        };
    }

    async upsertFromSeed(input: TermsSeedInput): Promise<void> {
        await this.db
            .insert(terms)
            .values({
                kind: input.kind,
                version: input.version,
                effectiveDate: input.effectiveDate,
                body: input.body,
            })
            .onConflictDoNothing({
                target: [terms.kind, terms.version],
            });
    }
}
