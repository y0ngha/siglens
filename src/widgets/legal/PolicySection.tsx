import type { ReactNode } from 'react';

interface PolicySectionProps {
    id: string;
    title: string;
    children: ReactNode;
}

export function PolicySection({ id, title, children }: PolicySectionProps) {
    return (
        <section
            id={id}
            className="scroll-mt-24 border-t border-secondary-700 pt-8"
        >
            <h2 className="text-xl font-semibold text-secondary-100">
                {title}
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-secondary-300 sm:text-base">
                {children}
            </div>
        </section>
    );
}
