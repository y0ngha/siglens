import { shouldShowEnglishName } from '@/entities/ticker/lib/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import type { AssetInfo } from '@/shared/lib/types';

/** 헤더가 그릴 이름 조각. 둘 다 null이면 티커만 남는다. */
export interface HeaderDisplayName {
    /** 앞세우는 한국어명. 그리지 않으면 null. */
    readonly koreanName: string | null;
    /** 영문명. 그리지 않으면 null. */
    readonly companyName: string | null;
    /** 관심종목·최근 본 종목에 저장되는 표시명. 한국어명 → 영문명 → 티커. */
    readonly watchlistLabel: string;
}

/**
 * 헤더 종목명 판정.
 *
 * 판정 자체는 `buildDisplayName`과 같은 `shouldShowEnglishName`을 쓴다 — 헤더는 색을 나눠
 * span으로 그리느라 그 문자열을 재사용할 수 없지만, 판정이 갈리면 같은 페이지의 `<title>`과
 * 헤더가 다른 이름을 말한다.
 *
 * 비-기본 로케일에서는 한국어명을 앞세우지 않는다(`/en/AAPL`이 `애플, Apple Inc.`가 되지
 * 않게). 영문명이 아예 없으면(국내 종목 다수) 비-ko에서도 한국어명을 남긴다 — 티커만
 * 남기는 것보다 낫고, `buildDisplayName`도 같은 폴백을 쓴다.
 */
export function resolveHeaderDisplayName(
    assetInfo: AssetInfo | null | undefined,
    ticker: string,
    locale: Locale
): HeaderDisplayName {
    if (!assetInfo) {
        return { koreanName: null, companyName: null, watchlistLabel: ticker };
    }
    const hasCompanyName = shouldShowEnglishName(
        assetInfo.name,
        assetInfo.koreanName,
        ticker,
        locale
    );
    const koreanName =
        assetInfo.koreanName && (locale === DEFAULT_LOCALE || !hasCompanyName)
            ? assetInfo.koreanName
            : null;
    return {
        koreanName,
        companyName: hasCompanyName ? assetInfo.name : null,
        watchlistLabel: koreanName ?? assetInfo.name,
    };
}
