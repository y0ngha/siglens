/** The titled section shell every `/about` content section shares. */
import type { ReactNode } from 'react';
import { SECTION_SUB, SECTION_TITLE } from '../aboutStyles';

interface AboutSectionProps {
    readonly id: string;
    readonly title: string;
    readonly sub?: string;
    /** Top margin; every section but the first sits `mt-20` below the last. */
    readonly className?: string;
    readonly children: ReactNode;
}

/** A `<section>` named by its h2 (`aria-labelledby`), with an optional lede. */
export function AboutSection({
    id,
    title,
    sub,
    className = 'mt-20',
    children,
}: AboutSectionProps) {
    return (
        <section aria-labelledby={id} className={className}>
            <h2 id={id} className={SECTION_TITLE}>
                {title}
            </h2>
            {sub ? <p className={SECTION_SUB}>{sub}</p> : null}
            {children}
        </section>
    );
}
