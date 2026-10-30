/**
 * The `/lp/stock-analysis` ad landing page.
 */
import { SITE_HOST } from '@/shared/lib/seo';
import { ReportReplay } from '@/widgets/replay/ReportReplay';
import {
    ANALYSIS_CTA,
    ANALYSIS_CTA_HREF,
    ANALYSIS_SCENARIOS,
    FEATURES,
    POPULAR,
} from './lib/stockAnalysisContent';
import { LpCtaLink } from './ui/LpCtaLink';
import { LpDisclaimer } from './ui/LpDisclaimer';
import { LpEndCta } from './ui/LpEndCta';
import { LpSection } from './ui/LpSection';
import { LpShell } from './ui/LpShell';
import { ReplayDoneIcon } from './ui/ReplayDoneIcon';
import { FeatureCard } from './ui/stock-analysis/FeatureCard';
import { PopularStockLinks } from './ui/stock-analysis/PopularStockLinks';

const REPLAY_LABELS = {
    host: SITE_HOST,
    region: '시그렌즈 분석 과정 예시',
    badge: '예시 화면',
    pause: '일시정지',
    resume: '다시 재생',
    sources: '근거',
} as const;

/**
 * `siglens.io/lp/stock-analysis`: ad-only landing for the `AI 주식 분석` ad
 * group, in `siglens.io/about`'s visual language (left-aligned hero with an
 * eyebrow, the auto-playing address-bar replay, icon data tiles, the closing
 * CTA card). Korean-only hard-coded copy with no crypto wording.
 */
export function StockAnalysisLanding() {
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

                <LpSection
                    id="lp-replay"
                    align="start"
                    title="종목 하나를 열면 이렇게 분석해요"
                    sub="시세와 차트를 불러와 지표와 패턴을 계산하고, AI가 한 편의 리포트로 정리합니다."
                    className="motion-safe:animate-[fade-up_400ms_ease-out_both]"
                >
                    <div className="mt-6">
                        <ReportReplay
                            scenarios={ANALYSIS_SCENARIOS}
                            labels={REPLAY_LABELS}
                            sourcesSeparator={false}
                            doneIcon={<ReplayDoneIcon />}
                        />
                    </div>
                    <p className="mt-2 text-xs text-secondary-400">
                        예시 화면이에요. 수치는 실제와 다를 수 있어요.
                    </p>
                </LpSection>

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
                    body="종목 페이지에서 차트, 재무, 뉴스, 옵션과 AI 리포트를 함께 볼 수 있어요."
                    cta={ANALYSIS_CTA}
                    href={ANALYSIS_CTA_HREF}
                />

                <LpDisclaimer />
            </div>
        </LpShell>
    );
}
