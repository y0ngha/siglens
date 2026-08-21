import 'server-only';

import type { Locale } from '@/shared/i18n/locales';
import type { LocalizedContent } from './contentLocale';
import { getContentTranslationRepository } from './contentTranslationClient';
import type { TranslatableEntity } from './contentTranslationFields';
import type { TranslationSource } from './contentTranslationFields';

/**
 * 한 필드의 번역 소스 정의.
 *
 * `legacy`는 **마이그레이션 전 원본 컬럼**을 로케일 맵으로 옮긴다. 뉴스처럼
 * `title_ko`/`title_en` 두 컬럼을 이미 갖고 있으면 두 로케일이 들어오고,
 * 공지처럼 한국어 컬럼 하나뿐이면 `{ ko: ... }` 하나만 들어온다. 사이드카에
 * 값이 있으면 그쪽이 이긴다(§ContentTranslations.resolve).
 */
export interface LocalizedFieldSpec<TRow> {
    /** `CONTENT_FIELD` 상수 값. 문자열 리터럴을 직접 쓰지 않는다. */
    readonly field: string;
    readonly legacy: (row: TRow) => Partial<Record<Locale, string | null>>;
    /**
     * `'human'`이면 AI 번역 행을 무시한다. 약관·개인정보처리방침처럼 오역이
     * 법적 의미를 바꾸는 문서에만 쓴다.
     */
    readonly minimumSource?: TranslationSource;
}

export interface LocalizeContentInput<TRow, TFields extends string> {
    readonly entity: TranslatableEntity;
    readonly rows: readonly TRow[];
    readonly locale: Locale;
    /** 사이드카 조회 키. 원본 PK를 문자열로 정규화해 돌려준다. */
    readonly id: (row: TRow) => string;
    readonly fields: Readonly<Record<TFields, LocalizedFieldSpec<TRow>>>;
}

/** 원본 행 + 해석된 필드. 원본은 그대로 두므로 기존 소비자가 깨지지 않는다. */
export type LocalizedRow<TRow, TFields extends string> = TRow & {
    readonly localized: Readonly<
        Record<TFields, LocalizedContent<string> | null>
    >;
};

/**
 * DB 행 묶음을 요청 로케일로 해석한다.
 *
 * **모든 엔티티가 이 함수 하나를 쓴다.** 뉴스·공지·약관·경제 캘린더·공유
 * 스냅샷이 각자 폴백을 구현하면 규칙이 갈린다 — 실제로 로케일을 보는 것은
 * 뉴스 제목 하나뿐이었고 나머지는 전부 한국어를 우선하고 있었다.
 *
 * 쿼리는 **행 수와 무관하게 1회**다. 카드 20장짜리 목록이 사이드카를 20번
 * 조회하면 목록 렌더가 DB 왕복 20회가 된다.
 *
 * 사이드카가 꺼져 있으면(`DB_CONTENT_LOCALE !== '1'`) 쿼리를 아예 하지
 * 않고 `legacy` 맵만으로 해석한다 — 마이그레이션 전 동작과 같다.
 */
export async function localizeContent<TRow, TFields extends string>({
    entity,
    rows,
    locale,
    id,
    fields,
}: LocalizeContentInput<TRow, TFields>): Promise<
    LocalizedRow<TRow, TFields>[]
> {
    const translations = await getContentTranslationRepository().findForEntity(
        entity,
        rows.map(id),
        locale
    );

    const fieldEntries = Object.entries(fields) as Array<
        [TFields, LocalizedFieldSpec<TRow>]
    >;

    return rows.map(row => {
        const entityId = id(row);
        const localized = {} as Record<
            TFields,
            LocalizedContent<string> | null
        >;
        for (const [name, spec] of fieldEntries) {
            localized[name] = translations.resolve(
                entityId,
                spec.field,
                spec.legacy(row),
                locale,
                spec.minimumSource ?? null
            );
        }
        return { ...row, localized } as LocalizedRow<TRow, TFields>;
    });
}

/** 단일 행 축약 — 약관·공지 상세처럼 행이 하나뿐인 경로용. */
export async function localizeContentRow<TRow, TFields extends string>(
    input: Omit<LocalizeContentInput<TRow, TFields>, 'rows'> & {
        readonly row: TRow;
    }
): Promise<LocalizedRow<TRow, TFields>> {
    const [only] = await localizeContent({ ...input, rows: [input.row] });
    // `rows`가 정확히 1개이므로 결과도 1개다 — 방어적 `!`가 아니라 계약이다.
    return only!;
}
