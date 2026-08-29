import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { contentTranslations } from './schema';
import type { SiglensDatabase } from './types';
import {
    CONTENT_LOCALE_FALLBACK,
    toContentLocale,
    type LocalizedContent,
} from './contentLocale';
import {
    isTranslationSource,
    TRANSLATION_SOURCE,
    type TranslatableEntity,
    type TranslationSource,
} from './contentTranslationFields';
import { pickContentLocale } from './contentLocale';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 한 (행, 필드)에 대한 로케일별 번역값.
 *
 * `source`를 함께 들고 있는 이유는 약관이다 — 인간 번역만 신뢰해야 하는 문서는
 * `human` 행만 골라야 하는데, 그 판단을 호출부가 하려면 출처가 값과 함께
 * 와야 한다.
 */
interface TranslationCell {
    readonly value: string;
    readonly source: TranslationSource;
}

/** `entityId` → `field` → `locale` → 값. */
type TranslationIndex = Map<string, Map<string, Map<Locale, TranslationCell>>>;

/**
 * 배치 조회 결과. 카드 20장을 그리는 화면이 쿼리를 20번 쏘지 않도록,
 * 읽기 경로는 **id 목록 단위**로 한 번 조회하고 이 객체에서 꺼내 쓴다.
 */
export class ContentTranslations {
    constructor(private readonly index: TranslationIndex) {}

    /** 비어 있는 결과 — 기능이 꺼져 있거나 번역 행이 하나도 없을 때. */
    static empty(): ContentTranslations {
        return new ContentTranslations(new Map());
    }

    /**
     * 사이드카에 있는 로케일별 값. 없으면 빈 객체.
     *
     * @param minimumSource `'human'`을 주면 AI 번역 행을 제외한다(약관).
     */
    byLocale(
        entityId: string,
        field: string,
        minimumSource: TranslationSource | null = null
    ): Partial<Record<Locale, string>> {
        const cells = this.index.get(entityId)?.get(field);
        if (cells === undefined) return {};
        const result: Partial<Record<Locale, string>> = {};
        for (const [locale, cell] of cells) {
            if (
                minimumSource === TRANSLATION_SOURCE.human &&
                cell.source !== TRANSLATION_SOURCE.human
            ) {
                continue;
            }
            result[locale] = cell.value;
        }
        return result;
    }

    /**
     * 원본 행의 로케일별 값(레거시 컬럼)과 사이드카를 합쳐 해석한다.
     *
     * 사이드카가 이긴다 — 원본의 `*_ko` 컬럼은 백필 전 임시 소스이고,
     * 번역 파이프라인이 다시 만든 값이 있으면 그쪽이 최신이다.
     */
    resolve(
        entityId: string,
        field: string,
        legacy: Partial<Record<Locale, string | null | undefined>>,
        locale: Locale,
        minimumSource: TranslationSource | null = null
    ): LocalizedContent<string> | null {
        const sidecar = this.byLocale(entityId, field, minimumSource);
        return pickContentLocale(
            { ...legacy, ...sidecar },
            locale,
            new Set(Object.keys(sidecar) as Locale[])
        );
    }
}

export interface ContentTranslationRepository {
    /**
     * 요청 로케일의 **폴백 체인 전체**를 한 번에 읽는다.
     *
     * 체인 전체를 읽는 이유: `ja`를 요청했는데 `ja` 행이 없으면 `en`을 써야
     * 하는데, 그걸 알려면 두 번째 쿼리가 필요해진다. 행 하나가 수십 바이트라
     * 3개 로케일을 한 번에 읽는 편이 왕복보다 싸다.
     */
    findForEntity(
        entity: TranslatableEntity,
        entityIds: readonly string[],
        locale: Locale
    ): Promise<ContentTranslations>;
}

/**
 * `content_translations` 테이블이 **아직 없을 때** 쓰는 구현.
 *
 * 마이그레이션은 `yarn db:migrate`로 수동 적용된다(배포가 자동으로 돌리지
 * 않는다). 그래서 코드가 먼저 배포될 수 있고, 그 사이 사이드카를 조회하면
 * `relation "content_translations" does not exist`로 **읽기 경로 전체가**
 * 죽는다 — 뉴스 목록이 통째로 빈 화면이 된다.
 *
 * 항상 빈 결과를 돌려주므로 호출부는 레거시 컬럼으로 폴백한다. 곧
 * 마이그레이션 전 동작과 정확히 같다.
 */
export class NullContentTranslationRepository implements ContentTranslationRepository {
    async findForEntity(): Promise<ContentTranslations> {
        return ContentTranslations.empty();
    }
}

/** Drizzle ORM 구현. */
export class DrizzleContentTranslationRepository implements ContentTranslationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findForEntity(
        entity: TranslatableEntity,
        entityIds: readonly string[],
        locale: Locale
    ): Promise<ContentTranslations> {
        if (entityIds.length === 0) return ContentTranslations.empty();

        const rows = await this.db
            .select({
                entityId: contentTranslations.entityId,
                field: contentTranslations.field,
                locale: contentTranslations.locale,
                value: contentTranslations.value,
                source: contentTranslations.source,
            })
            .from(contentTranslations)
            .where(
                and(
                    eq(contentTranslations.entity, entity),
                    inArray(contentTranslations.entityId, [...entityIds]),
                    inArray(contentTranslations.locale, [
                        ...CONTENT_LOCALE_FALLBACK[locale],
                    ])
                )
            );

        const index: TranslationIndex = new Map();
        for (const row of rows) {
            const rowLocale = toContentLocale(row.locale);
            // 알 수 없는 로케일 행은 버린다 — 어느 언어인지 모르는 문구를
            // 화면에 붙이는 것보다 폴백이 낫다(§contentLocale.toContentLocale).
            if (rowLocale === null) continue;
            const source = isTranslationSource(row.source)
                ? row.source
                : TRANSLATION_SOURCE.ai;

            let byField = index.get(row.entityId);
            if (byField === undefined) {
                byField = new Map();
                index.set(row.entityId, byField);
            }
            let byLocale = byField.get(row.field);
            if (byLocale === undefined) {
                byLocale = new Map();
                byField.set(row.field, byLocale);
            }
            byLocale.set(rowLocale, { value: row.value, source });
        }
        return new ContentTranslations(index);
    }
}
