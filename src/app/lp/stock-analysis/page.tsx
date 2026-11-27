import type { Metadata } from 'next';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { StockAnalysisLanding } from '@/views/lp/StockAnalysisLanding';
import { loadLpRealAnalyses } from './_lib/loadLpRealAnalyses';

/** Ad-only page: never indexed, no canonical, alternates or JSON-LD. */
export const metadata: Metadata = {
    // 한국어 전용 광고 페이지 — 기본 로케일(ko) 접미사 `| 시그렌즈`.
    title: brandTitle('AI 주식 분석', DEFAULT_LOCALE),
    description:
        '미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아 AI가 정리합니다.',
    robots: { index: false, follow: false },
};

/**
 * 6h ISR, same literal as `[symbol]`: the page reads the same snapshot cache entry, and the
 * prewarm cron's `revalidateTag` refreshes it early. Must stay a literal (AP-6).
 */
export const revalidate = 21600;

/** `/lp/stock-analysis` 광고 랜딩. 본문은 `StockAnalysisLanding` 뷰가 그린다. */
export default async function StockAnalysisLandingPage() {
    const analyses = await loadLpRealAnalyses(revalidate);
    return <StockAnalysisLanding analyses={analyses} />;
}
