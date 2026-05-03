interface ThreeAxisConclusionProps {
    text: string;
}

/**
 * Renders the central 3-axis synthesis conclusion — the focal result of the
 * overall analysis combining technical + fundamental + news signals.
 *
 * Visually elevated relative to the individual axis summary sections.
 */
export function ThreeAxisConclusion({ text }: ThreeAxisConclusionProps) {
    if (!text) return null;
    return (
        <section
            aria-labelledby="three-axis-conclusion-heading"
            className="border-primary/30 bg-primary/5 rounded-xl border p-6"
        >
            <h2
                id="three-axis-conclusion-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                3축 종합 결론
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">
                {text}
            </p>
        </section>
    );
}
