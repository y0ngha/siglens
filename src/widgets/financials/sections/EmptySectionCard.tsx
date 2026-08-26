import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';
export const EMPTY_MESSAGE = '데이터를 불러올 수 없어요';

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
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={headingId} className={cn('mb-4', HEADING_SECTION)}>
                {title}
            </h2>
            <p className="text-sm text-secondary-400">{EMPTY_MESSAGE}</p>
        </section>
    );
}
