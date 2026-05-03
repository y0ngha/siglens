'use client';

interface OverallTriggerCtaProps {
    onTrigger: () => void;
}

export function OverallTriggerCta({ onTrigger }: OverallTriggerCtaProps) {
    return (
        <section
            aria-labelledby="overall-cta-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-12 text-center"
        >
            <h2
                id="overall-cta-heading"
                className="text-2xl font-semibold text-balance"
            >
                AI 종합 분석
            </h2>
            <p className="text-secondary-400 mt-3 text-sm leading-relaxed">
                기술적 분석 · 펀더멘털 · 뉴스를 통합한 종합 분석을 받아보세요.
            </p>
            <button
                type="button"
                onClick={onTrigger}
                className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 mt-6 inline-flex items-center rounded-md px-6 py-3 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                AI 종합 분석 받기
            </button>
        </section>
    );
}
