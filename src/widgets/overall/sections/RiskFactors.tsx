import { MarkdownText } from '@/shared/ui/MarkdownText';

interface RiskFactorsProps {
    factors: string[];
}

export function RiskFactors({ factors }: RiskFactorsProps) {
    if (factors.length === 0) return null;
    return (
        <section
            aria-labelledby="risk-factors-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="risk-factors-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                위험 요인
            </h2>
            <ul aria-label="위험 요인 목록" className="space-y-2">
                {factors.map(factor => (
                    <li key={factor} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-400"
                        >
                            •
                        </span>
                        <MarkdownText className="min-w-0 text-secondary-400">
                            {factor}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
