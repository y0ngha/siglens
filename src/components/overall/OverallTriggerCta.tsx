'use client';

interface OverallTriggerCtaProps {
    onTrigger: () => void;
}

/**
 * Initial call-to-action card shown when the overall analysis has not been
 * triggered yet. Clicking the button starts the 3-axis AI analysis.
 */
export function OverallTriggerCta({ onTrigger }: OverallTriggerCtaProps) {
    return (
        <section
            aria-labelledby="overall-cta-heading"
            className="rounded-xl border border-border bg-card p-12 text-center"
        >
            <h2
                id="overall-cta-heading"
                className="text-2xl font-semibold text-balance"
            >
                AI 종합 분석
            </h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                기술적 분석 · 펀더멘털 · 뉴스를 통합한 종합 분석을 받아보세요.
            </p>
            <button
                type="button"
                onClick={onTrigger}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary mt-6 inline-flex items-center rounded-md px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
                AI 종합 분석 받기
            </button>
        </section>
    );
}
