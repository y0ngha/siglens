/** The `/about` closing call-to-action card. */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { PRIMARY_BUTTON } from '../aboutStyles';

interface EndCtaProps {
    readonly title: string;
    readonly body: string;
    readonly buttonLabel: string;
    /** The ticker page the button opens. */
    readonly href: string;
}

/** A centred h2, one line of copy and the primary button. */
export function EndCta({ title, body, buttonLabel, href }: EndCtaProps) {
    return (
        <section className={cn(SURFACE_CARD, 'mt-12 px-6 py-9 text-center')}>
            <h2 className={HEADING_SECTION}>{title}</h2>
            <p className="mt-2 text-sm text-secondary-400">{body}</p>
            <LocaleLink href={href} className={cn(PRIMARY_BUTTON, 'mt-5')}>
                {buttonLabel}
            </LocaleLink>
        </section>
    );
}
