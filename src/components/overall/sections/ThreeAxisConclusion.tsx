import { MarkdownText } from '@/components/ui/MarkdownText';

interface ThreeAxisConclusionProps {
    text: string;
}

// Visually elevated vs sibling axis summaries — the focal synthesis section.
export function ThreeAxisConclusion({ text }: ThreeAxisConclusionProps) {
    if (!text) return null;
    return (
        <section
            aria-labelledby="three-axis-conclusion-heading"
            className="border-primary-500/30 bg-primary-600/5 rounded-xl border p-6"
        >
            <h2
                id="three-axis-conclusion-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                3축 종합 결론
            </h2>
            <MarkdownText className="text-sm">{text}</MarkdownText>
        </section>
    );
}
