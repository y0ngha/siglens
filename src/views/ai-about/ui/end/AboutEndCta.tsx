import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { ABOUT_PRIMARY_BUTTON } from '../aboutStyles';

interface Props {
    readonly title: string;
    readonly body: string;
    readonly button: string;
    /** The chat home of the page locale. */
    readonly href: string;
}

/** The closing card that sends the reader into the chat. */
export function AboutEndCta({ title, body, button, href }: Props) {
    return (
        <section className={cn(SURFACE_CARD, 'mt-12 px-6 py-9 text-center')}>
            <h2 className={HEADING_SECTION}>{title}</h2>
            <p className="mt-2 text-sm text-secondary-400">{body}</p>
            <a href={href} className={cn(ABOUT_PRIMARY_BUTTON, 'mt-5')}>
                {button}
            </a>
        </section>
    );
}
