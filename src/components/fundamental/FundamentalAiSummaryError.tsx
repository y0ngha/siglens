'use client';

interface FundamentalAiSummaryErrorProps {
    error: unknown;
}

export function FundamentalAiSummaryError({
    error,
}: FundamentalAiSummaryErrorProps) {
    const message =
        error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.';

    return (
        <section
            aria-labelledby="ai-summary-error-heading"
            className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="ai-summary-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                AI 펀더멘털 분석
            </h2>
            <p className="text-ui-danger text-sm" role="alert">
                {message}
            </p>
        </section>
    );
}
