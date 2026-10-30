import {
    pickContentLocale,
    toContentLocale,
    type LocalizedContent,
} from './contentLocale';
import {
    isTranslationSource,
    TRANSLATION_SOURCE,
    type TranslationSource,
} from './contentTranslationFields';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 한 (행, 필드)에 대한 로케일별 번역값.
 *
 * `source`를 함께 들고 있는 이유는 약관이다 — 인간 번역만 신뢰해야 하는 문서는
 * `human` 행만 골라야 하는데, 그 판단을 호출부가 하려면 출처가 값과 함께
 * 와야 한다.
 */
export interface TranslationCell {
    readonly value: string;
    readonly source: TranslationSource;
}

/** `entityId` → `field` → `locale` → 값. */
export type TranslationIndex = Map<
    string,
    Map<string, Map<Locale, TranslationCell>>
>;

/**
 * 배치 조회 결과. 카드 20장을 그리는 화면이 쿼리를 20번 쏘지 않도록,
 * 읽기 경로는 **id 목록 단위**로 한 번 조회하고 이 객체에서 꺼내 쓴다.
 * 리포지터리 구현(`contentTranslationRepository`)이 채우고 `localizeContent`가 읽는다.
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

/** 리포지터리가 DB에서 읽어 `buildTranslationIndex`에 넘기는 번역 행(로케일·출처는 아직 검증 전). */
export interface TranslationRow {
    readonly entityId: string;
    readonly field: string;
    readonly locale: string;
    readonly value: string;
    readonly source: string;
}

/**
 * DB 행을 `ContentTranslations` 색인으로 접는다.
 *
 * 알 수 없는 로케일 행은 버린다 — 어느 언어인지 모르는 문구를 화면에 붙이는 것보다
 * 폴백이 낫다(`toContentLocale` 참고). 알 수 없는 `source`는 `ai`로 본다 — 인간
 * 번역으로 승격하면 약관이 검증 안 된 번역을 내보낼 수 있다.
 */
export function buildTranslationIndex(
    rows: readonly TranslationRow[]
): ContentTranslations {
    const index: TranslationIndex = new Map();
    for (const row of rows) {
        const locale = toContentLocale(row.locale);
        if (locale === null) continue;
        const source = isTranslationSource(row.source)
            ? row.source
            : TRANSLATION_SOURCE.ai;
        const byField = index.get(row.entityId) ?? new Map();
        const byLocale = byField.get(row.field) ?? new Map();
        byLocale.set(locale, { value: row.value, source });
        byField.set(row.field, byLocale);
        index.set(row.entityId, byField);
    }
    return new ContentTranslations(index);
}
