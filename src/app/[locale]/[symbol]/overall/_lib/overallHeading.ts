import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import type { SeoTranslator } from '@/shared/lib/seo';

/**
 * 종합 탭 h1 — 미국 개별주식·한국 개별주식·크립토 세 갈래다(`app.symbol` 번역자를 받는다).
 *
 * `MarketProfileId`로 exhaustive하게 고른다: 새 market profile이 생기면 `never` 대입에서 컴파일
 * 에러가 난다(CONVENTIONS.md#CP-1). 런타임에 모르는 값이 와도 미국 주식 문구로 폴백하고 로그를 남긴다.
 */
export function buildOverallHeading(
    marketProfile: MarketProfileId,
    displayName: string,
    t: SeoTranslator
): string {
    switch (marketProfile) {
        case 'us-equity':
            return t('page.overallHeadingUsEquity', { v0: displayName });
        case 'kr-equity':
            return t('page.overallHeadingKrEquity', { v0: displayName });
        case 'crypto':
            return t('page.overallHeadingCrypto', { v0: displayName });
        default: {
            const _exhaustive: never = marketProfile;
            console.error(
                `[OverallPage] Unhandled MarketProfileId: ${String(_exhaustive)} — defaulting to us-equity copy`
            );
            return buildOverallHeading('us-equity', displayName, t);
        }
    }
}
