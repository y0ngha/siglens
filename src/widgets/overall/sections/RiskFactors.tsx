import { MarkdownText } from '@/shared/ui/MarkdownText';

interface RiskFactorsProps {
    factors: string[];
}

export function RiskFactors({ factors }: RiskFactorsProps) {
    if (factors.length === 0) return null;
    return (
        <section
            aria-labelledby="risk-factors-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="risk-factors-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                위험 요인
            </h2>
            <ul aria-label="위험 요인 목록" className="space-y-2">
                {factors.map((factor, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="text-secondary-400 mt-0.5 shrink-0"
                        >
                            •
                        </span>
                        <MarkdownText className="text-secondary-400 min-w-0">
                            {factor}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
