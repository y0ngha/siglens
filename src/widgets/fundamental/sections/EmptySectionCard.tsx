import type { ReactNode } from 'react';

export const EMPTY_MESSAGE = '데이터를 불러올 수 없어요';

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
    return (
        <section
            aria-labelledby={headingId}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={headingId} className={headingClassName}>
                {title}
            </h2>
            <p className="text-sm text-secondary-400">{EMPTY_MESSAGE}</p>
            {children}
        </section>
    );
}
