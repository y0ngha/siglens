/**
 * A landing-page content section: an `h2` (the section's accessible name), an
 * optional sub-line, then the section body.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** `start` follows `AboutPage`'s left-aligned sections, `center` `AiAboutPage`'s centred ones. */
export type LpSectionAlign = 'start' | 'center';

const TITLE: Record<LpSectionAlign, string> = {
    start: cn(HEADING_SECTION, 'text-2xl sm:text-[28px]'),
    center: cn(HEADING_SECTION, 'text-center text-2xl sm:text-[28px]'),
};

const SUB: Record<LpSectionAlign, string> = {
    start: 'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400',
    center: 'mx-auto mt-2 max-w-xl text-center text-[15px] leading-6 text-secondary-400',
};

interface LpSectionProps {
    /** Id of the `h2`; the section is labelled by it. Unique per page. */
    readonly id: string;
    readonly title: string;
    readonly sub?: string;
    readonly align: LpSectionAlign;
    readonly className?: string;
    readonly children: ReactNode;
}

/** A section labelled by its own `h2`. */
export function LpSection({
    id,
    title,
    sub,
    align,
    className,
    children,
}: LpSectionProps) {
    return (
        <section aria-labelledby={id} className={className}>
            <h2 id={id} className={TITLE[align]}>
                {title}
            </h2>
            {sub && <p className={SUB[align]}>{sub}</p>}
            {children}
        </section>
    );
}
