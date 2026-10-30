import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import type { Locale } from '@/shared/i18n/locales';
import { CONTENT_LOCALE_FALLBACK } from './contentLocale';
import type { TranslatableEntity } from './contentTranslationFields';
import {
    buildTranslationIndex,
    ContentTranslations,
} from './contentTranslations';
import { contentTranslations } from './schema';
import type { SiglensDatabase } from './types';

/** 번역 사이드카 읽기 포트. 구현 선택은 `getContentTranslationRepository`가 한다. */
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

/** `DB_CONTENT_LOCALE=1`일 때 쓰는 실제 조회 구현. 쿼리는 호출당 1회다. */
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

        return buildTranslationIndex(rows);
    }
}
