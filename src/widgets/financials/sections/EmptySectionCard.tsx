import { useTranslations } from 'next-intl';
/** `widgets.financials.section` 키 — 두 위젯이 같은 문구를 쓴다. */
export const EMPTY_MESSAGE_KEY = 'emptySection';

interface EmptySectionCardProps {
    title: string;
}

/**
 * Fallback card shown when a financial statement section has no data.
 * Mirrors the fundamental widget's EmptySectionCard API with a simplified
 * props interface (no headingId/headingClassName variants needed here).
 */
export function EmptySectionCard({ title }: EmptySectionCardProps) {
    const tSection = useTranslations('widgets.financials.section');
    const headingId = `${title.replace(/\s+/g, '-').toLowerCase()}-empty-heading`;

    return (
        <section
            aria-labelledby={headingId}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id={headingId}
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                {title}
            </h2>
            <p className="text-sm text-secondary-400">
                {tSection(EMPTY_MESSAGE_KEY)}
            </p>
        </section>
    );
}
