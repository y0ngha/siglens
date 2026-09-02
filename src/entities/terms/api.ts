import type { TermsKind } from '@/shared/db/constants';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { contentTranslations, terms } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { localizeContentRow } from '@/shared/db/localizeContent';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
    TRANSLATION_SOURCE,
} from '@/shared/db/contentTranslationFields';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

/** Public-facing record returned by the repository. */
export interface TermsRecord {
    id: string;
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    /** 요청 로케일로 해석이 끝난 본문. */
    body: string;
    /** 본문을 실제로 제공한 로케일. */
    bodyLocale: Locale;
    /**
     * 번역이 없어 다른 로케일 원문을 보여주고 있는가.
     *
     * **화면이 반드시 알려야 한다.** 읽지 못하는 언어의 약관에 동의시키는 것은
     * 기능 결함이 아니라 법적 문제다 — `/terms`·`/privacy`가 이 값으로 안내
     * 배너를 띄운다.
     */
    isTranslationFallback: boolean;
}

/** Input used by the seed script to upsert a versioned terms row. */
export interface TermsSeedInput {
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

/** Input used by the seed script to upsert a human-authored body translation. */
export interface TermsTranslationInput {
    /** `terms` 행의 uuid. `upsertFromSeed`가 돌려준 값이다. */
    termsId: string;
    locale: Locale;
    body: string;
}

/** Repository for versioned legal terms documents. */
export interface TermsRepository {
    /**
     * Return the active version for the given kind, or null if none.
     *
     * 본문은 요청 로케일로 해석한다. **인간 번역(`source = 'human'`)만
     * 신뢰한다** — 약관은 오역이 곧 의무의 변경이라 AI 번역을 그대로 내보낼 수
     * 없다(설계 §2.5). 인간 번역이 없으면 원문으로 폴백하고 `isTranslationFallback`을
     * 세운다.
     */
    findActive(kind: TermsKind, locale: Locale): Promise<TermsRecord | null>;
    /**
     * Insert a versioned row; no-op on (kind, version) conflict.
     *
     * 충돌해도 **그 행의 id를 돌려준다** — 번역 사이드카가 `entityId`로 이 값을
     * 쓰므로, 이미 적재된 버전에 번역만 덧붙이는 재실행이 성립해야 한다.
     */
    upsertFromSeed(input: TermsSeedInput): Promise<string>;
    /**
     * 인간이 쓴 본문 번역을 사이드카에 적재한다. 재실행하면 갱신된다.
     *
     * `source`를 항상 `human`으로 박는다 — 읽기 경로(`findActive`)가 그 값만
     * 신뢰하므로, `ai`로 들어간 행은 화면에 나오지도 않으면서 테이블만 채운다.
     */
    upsertTranslation(input: TermsTranslationInput): Promise<void>;
}

/** Drizzle ORM-backed implementation. */
export class DrizzleTermsRepository implements TermsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(
        kind: TermsKind,
        locale: Locale
    ): Promise<TermsRecord | null> {
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

        const row = rows[0]!;
        const localized = await localizeContentRow({
            entity: TRANSLATABLE_ENTITY.terms,
            row,
            locale,
            id: current => current.id,
            fields: {
                body: {
                    field: CONTENT_FIELD.terms.body,
                    legacy: current => ({ ko: current.body }),
                    minimumSource: TRANSLATION_SOURCE.human,
                },
            },
        });
        const body = localized.localized.body;

        return {
            id: row.id,
            // Safe: pgEnum('terms_kind', TERMS_KIND_VALUES) constrains the DB column to TermsKind values.
            kind: row.kind as TermsKind,
            version: row.version,
            effectiveDate: row.effectiveDate,
            // 해석 실패(사이드카가 빈 문자열)여도 원문은 항상 있다 — 약관이
            // 빈 화면으로 나가는 것이 최악이므로 원본으로 되돌린다.
            body: body?.value ?? row.body,
            bodyLocale: body?.locale ?? DEFAULT_LOCALE,
            isTranslationFallback: body?.isFallback ?? true,
        };
    }

    async upsertFromSeed(input: TermsSeedInput): Promise<string> {
        const inserted = await withRetry(
            () =>
                this.db
                    .insert(terms)
                    .values({
                        kind: input.kind,
                        version: input.version,
                        effectiveDate: input.effectiveDate,
                        body: input.body,
                    })
                    .onConflictDoNothing({
                        target: [terms.kind, terms.version],
                    })
                    .returning({ id: terms.id }),
            NEON_TRANSIENT_RETRY
        );
        const insertedId = inserted[0]?.id;
        if (insertedId !== undefined) return insertedId;

        // 충돌 = 이미 적재된 버전. 발효된 본문은 조용히 바꾸지 않는다(그래서
        // DoNothing이다). 하지만 번역을 붙이려면 그 행의 id가 여전히 필요하다.
        const existing = await withRetry(
            () =>
                this.db
                    .select({ id: terms.id })
                    .from(terms)
                    .where(
                        and(
                            eq(terms.kind, input.kind),
                            eq(terms.version, input.version)
                        )
                    )
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        const existingId = existing[0]?.id;
        if (existingId === undefined) {
            throw new Error(
                `terms ${input.kind} v${input.version} not found after upsert`
            );
        }
        return existingId;
    }

    async upsertTranslation(input: TermsTranslationInput): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(contentTranslations)
                    .values({
                        entity: TRANSLATABLE_ENTITY.terms,
                        entityId: input.termsId,
                        field: CONTENT_FIELD.terms.body,
                        locale: input.locale,
                        value: input.body,
                        source: TRANSLATION_SOURCE.human,
                    })
                    .onConflictDoUpdate({
                        target: [
                            contentTranslations.entity,
                            contentTranslations.entityId,
                            contentTranslations.field,
                            contentTranslations.locale,
                        ],
                        set: {
                            value: input.body,
                            source: TRANSLATION_SOURCE.human,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }
}
