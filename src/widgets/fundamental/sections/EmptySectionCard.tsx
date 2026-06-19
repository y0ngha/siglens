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
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2 id={headingId} className={headingClassName}>
                {title}
            </h2>
            <p className="text-secondary-400 text-sm">{EMPTY_MESSAGE}</p>
            {children}
        </section>
    );
}
