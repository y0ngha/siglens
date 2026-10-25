import { getTranslations } from 'next-intl/server';
import type { GuideCategory } from '@/entities/guide/types';
import type { Locale } from '@/shared/i18n/locales';

/** 분류마다 달라지는 문구 한 벌. 모든 분류 키가 항상 채워져 있다. */
export interface GuideCategoryCopy {
    /** 칩·브레드크럼·제목에 쓰는 표시명. */
    readonly label: Readonly<Record<GuideCategory, string>>;
    /** 분류 허브 상단의 한 단락. */
    readonly intro: Readonly<Record<GuideCategory, string>>;
    /** 분류 허브 `<title>`(브랜드 접미사 제외). */
    readonly seoTitle: Readonly<Record<GuideCategory, string>>;
}

/**
 * 분류별 문구를 불러온다.
 *
 * `t('리터럴')`을 키마다 직접 적는 이유: 번역자를 인자로 받는 헬퍼나 `t(`category.${c}`)`
 * 같은 동적 조회는 i18n 추출기가 사용 중인 키로 세지 못해 `--write` 한 번에 카탈로그에서
 * 지워진다. 번역자를 이 함수 안에서 선언해 모든 소비자가 같은 정적 키를 읽게 한다.
 */
export async function loadGuideCategoryCopy(
    locale: Locale
): Promise<GuideCategoryCopy> {
    const t = await getTranslations({ locale, namespace: 'views.guide' });
    return {
        label: {
            howto: t('categoryHowto'),
            candlesticks: t('categoryCandlesticks'),
            'chart-patterns': t('categoryChartPatterns'),
            indicators: t('categoryIndicators'),
            strategies: t('categoryStrategies'),
        },
        intro: {
            howto: t('categoryIntroHowto'),
            candlesticks: t('categoryIntroCandlesticks'),
            'chart-patterns': t('categoryIntroChartPatterns'),
            indicators: t('categoryIntroIndicators'),
            strategies: t('categoryIntroStrategies'),
        },
        seoTitle: {
            howto: t('categorySeoTitleHowto'),
            candlesticks: t('categorySeoTitleCandlesticks'),
            'chart-patterns': t('categorySeoTitleChartPatterns'),
            indicators: t('categorySeoTitleIndicators'),
            strategies: t('categorySeoTitleStrategies'),
        },
    };
}

/** 허브·분류 허브의 `generateMetadata`가 읽는 SEO 문구. 분류 문구는 위 함수가 맡는다. */
export interface GuideHubSeoCopy {
    readonly hubTitle: string;
    readonly hubSeoTitle: string;
    readonly hubSeoDescription: string;
    readonly hubSeoKeywords: readonly string[];
    /**
     * 분류 허브 설명 — 분류마다 문장이 다르다(같은 틀에 이름만 바꾸면 4개가 사실상 중복 description이다).
     * `{count}`만 ICU로 채운다.
     */
    readonly categoryDescription: (
        category: GuideCategory,
        count: number
    ) => string;
}

/** 허브 문구에 들어가는 항목 수. 용어(howto가 아닌 항목)와 실전 가이드(howto)를 따로 센다. */
export interface GuideHubCounts {
    readonly terms: number;
    readonly howto: number;
}

export function countGuideHubEntries(
    entries: readonly { readonly category: GuideCategory }[]
): GuideHubCounts {
    const howto = entries.filter(entry => entry.category === 'howto').length;
    return { terms: entries.length - howto, howto };
}

export async function loadGuideHubSeoCopy(
    locale: Locale,
    counts: GuideHubCounts
): Promise<GuideHubSeoCopy> {
    const t = await getTranslations({ locale, namespace: 'views.guide' });
    return {
        hubTitle: t('hubTitle'),
        hubSeoTitle: t('hubSeoTitle'),
        // 실전 가이드가 아직 없으면(시드 전) "0편"을 적지 않는 문구로 돌아간다.
        hubSeoDescription:
            counts.howto > 0
                ? t('hubSeoDescriptionWithHowto', {
                      terms: counts.terms,
                      howto: counts.howto,
                  })
                : t('hubSeoDescription', { terms: counts.terms }),
        hubSeoKeywords: t('hubSeoKeywords')
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword !== ''),
        // 정적 리터럴 키 — 동적 조회는 i18n 추출기가 못 센다(위 `loadGuideCategoryCopy` 참고).
        categoryDescription: (category, count) => {
            switch (category) {
                case 'howto':
                    return t('categorySeoDescriptionHowto', { count });
                case 'candlesticks':
                    return t('categorySeoDescriptionCandlesticks', { count });
                case 'chart-patterns':
                    return t('categorySeoDescriptionChartPatterns', { count });
                case 'indicators':
                    return t('categorySeoDescriptionIndicators', { count });
                case 'strategies':
                    return t('categorySeoDescriptionStrategies', { count });
                default: {
                    // 분류가 추가되면 여기서 컴파일 에러가 난다 — 문구 키를 함께 추가해야 한다.
                    const exhaustive: never = category;
                    throw new Error(
                        `Unhandled guide category: ${String(exhaustive)}`
                    );
                }
            }
        },
    };
}
