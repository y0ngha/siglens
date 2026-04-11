import type { ReactNode } from 'react';

export interface TocItem {
    id: string;
    label: string;
}

interface PolicySectionProps {
    id: string;
    title: string;
    children: ReactNode;
}

export function PolicySection({ id, title, children }: PolicySectionProps) {
    return (
        <section
            id={id}
            className="border-secondary-800 scroll-mt-24 border-t pt-8"
        >
            <h2 className="text-secondary-100 text-xl font-semibold">
                {title}
            </h2>
            <div className="text-secondary-300 mt-4 space-y-3 text-sm leading-relaxed sm:text-base">
                {children}
            </div>
        </section>
    );
}
