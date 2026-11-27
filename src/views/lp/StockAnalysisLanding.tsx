/**
 * The `/lp/stock-analysis` ad landing page.
 */
import { cn } from '@/shared/lib/cn';
import {
    ANALYSIS_CTA,
    ANALYSIS_CTA_HREF,
    FEATURES,
    POPULAR,
    REAL_ANALYSIS_COPY,
} from './lib/stockAnalysisContent';
import type { LpRealAnalysis } from './lib/types';
import { LpCtaLink } from './ui/LpCtaLink';
import { LpDisclaimer } from './ui/LpDisclaimer';
import { LpEndCta } from './ui/LpEndCta';
import { LpSection } from './ui/LpSection';
import { LpShell } from './ui/LpShell';
import { FeatureCard } from './ui/stock-analysis/FeatureCard';
import { PopularStockLinks } from './ui/stock-analysis/PopularStockLinks';
import { RealAnalysisCard } from './ui/stock-analysis/RealAnalysisCard';

interface StockAnalysisLandingProps {
    readonly analyses: readonly LpRealAnalysis[];
}

/**
 * `siglens.io/lp/stock-analysis`: ad-only landing for the `AI 주식 분석` ad
 * group, in `siglens.io/about`'s visual language (left-aligned hero with an
 * eyebrow, real cached analysis excerpts, icon data tiles, the closing CTA
 * card). Korean-only hard-coded copy with no crypto wording. The excerpts come
 * from the prewarmed snapshots (`analyses`); a symbol without a usable one is
 * simply absent, and with none left the whole section is omitted.
 */
export function StockAnalysisLanding({ analyses }: StockAnalysisLandingProps) {
    return (
        <LpShell
            selfHref="/lp/stock-analysis"
            cta={ANALYSIS_CTA}
            ctaHref={ANALYSIS_CTA_HREF}
        >
            <div className="mx-auto max-w-4xl">
                <section className="pt-12 pb-10 sm:pt-16">
                    <p className="text-sm font-medium text-secondary-400">
                        AI 주식 분석
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        종목 하나로 AI 종합 분석
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                        미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아
                        AI가 정리합니다.
                    </p>
                    <LpCtaLink href={ANALYSIS_CTA_HREF} className="mt-6">
                        {ANALYSIS_CTA}
                    </LpCtaLink>
                </section>

                {analyses.length > 0 && (
                    <LpSection
                        id="lp-real-analysis"
                        align="start"
                        title={REAL_ANALYSIS_COPY.title}
                        sub={REAL_ANALYSIS_COPY.sub}
                        className="motion-safe:animate-[fade-up_400ms_ease-out_both]"
                    >
                        <ul
                            className={cn(
                                'mt-6 grid gap-3',
                                analyses.length > 1 && 'sm:grid-cols-2'
                            )}
                        >
                            {analyses.map(analysis => (
                                <RealAnalysisCard
                                    key={analysis.symbol}
                                    analysis={analysis}
                                />
                            ))}
                        </ul>
                        <p className="mt-2 text-xs text-secondary-400">
                            {REAL_ANALYSIS_COPY.note}
                        </p>
                    </LpSection>
                )}

                <LpSection
                    id="lp-features"
                    align="start"
                    title="한 화면에서 보는 종목 분석"
                    className="mt-20"
                >
                    <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                        {FEATURES.map(feature => (
                            <FeatureCard key={feature.title} {...feature} />
                        ))}
                    </ul>
                </LpSection>

                <LpSection
                    id="lp-popular"
                    align="start"
                    title="많이 찾는 종목"
                    className="mt-20"
                >
                    <PopularStockLinks stocks={POPULAR} />
                </LpSection>

                <LpEndCta
                    title="궁금한 종목을 바로 열어 보세요"
                    body="종목 페이지에서 차트, 재무, 뉴스, 옵션과 AI 리포트를 함께 볼 수 있습니다."
                    cta={ANALYSIS_CTA}
                    href={ANALYSIS_CTA_HREF}
                />

                <LpDisclaimer />
            </div>
        </LpShell>
    );
}
