import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface Props {
    /** Id of the heading, which names the section through `aria-labelledby`. */
    readonly id: string;
    readonly title: string;
    /** Optional one-line lede under the heading. */
    readonly sub?: string;
    readonly children: ReactNode;
}

/**
 * A main `/about` section: a centred, enlarged section heading that names the
 * region, an optional lede, then the section body.
 */
export function AboutSection({ id, title, sub, children }: Props) {
    return (
        <section aria-labelledby={id} className="mt-20">
            <h2
                id={id}
                className={cn(
                    HEADING_SECTION,
                    'text-center text-2xl sm:text-[28px]'
                )}
            >
                {title}
            </h2>
            {sub ? (
                <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            {children}
        </section>
    );
}
