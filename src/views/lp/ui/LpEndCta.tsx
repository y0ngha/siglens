/**
 * The closing call-to-action card both landing pages place above the disclaimer.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LpCtaLink } from './LpCtaLink';

interface LpEndCtaProps {
    readonly title: string;
    readonly body: string;
    readonly cta: string;
    readonly href: string;
}

/** A centred card with an `h2`, one line of copy and the primary CTA. */
export function LpEndCta({ title, body, cta, href }: LpEndCtaProps) {
    return (
        <section
            aria-labelledby="lp-end"
            className={cn(SURFACE_CARD, 'mt-20 px-6 py-9 text-center')}
        >
            <h2 id="lp-end" className={HEADING_SECTION}>
                {title}
            </h2>
            <p className="mt-2 text-sm text-secondary-400">{body}</p>
            <LpCtaLink href={href} className="mt-5">
                {cta}
            </LpCtaLink>
        </section>
    );
}
