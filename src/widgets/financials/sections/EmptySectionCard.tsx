export const EMPTY_MESSAGE = '데이터를 불러올 수 없습니다.';

interface EmptySectionCardProps {
    title: string;
}

/**
 * Fallback card shown when a financial statement section has no data.
 * Mirrors the fundamental widget's EmptySectionCard API with a simplified
 * props interface (no headingId/headingClassName variants needed here).
 */
export function EmptySectionCard({ title }: EmptySectionCardProps) {
    const headingId = `${title.replace(/\s+/g, '-').toLowerCase()}-empty-heading`;

    return (
        <section
            aria-labelledby={headingId}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id={headingId}
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                {title}
            </h2>
            <p className="text-secondary-400 text-sm">{EMPTY_MESSAGE}</p>
        </section>
    );
}
