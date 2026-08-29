import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/** `widgets.financials.section` 키 — 두 위젯이 같은 문구를 쓴다. */
export const EMPTY_MESSAGE_KEY = 'emptySection';

interface EmptySectionCardProps {
    headingId: string;
    title: string;
    headingClassName: string;
    children?: ReactNode;
}

export function EmptySectionCard({
    headingId,
    title,
    headingClassName,
    children,
}: EmptySectionCardProps) {
    const tSection = useTranslations('widgets.financials.section');
    return (
        <section
            aria-labelledby={headingId}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={headingId} className={headingClassName}>
                {title}
            </h2>
            <p className="text-sm text-secondary-400">
                {tSection(EMPTY_MESSAGE_KEY)}
            </p>
            {children}
        </section>
    );
}
