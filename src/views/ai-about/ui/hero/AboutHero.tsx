import { cn } from '@/shared/lib/cn';
import { SiglensMark } from '@/widgets/agent-chat/SiglensMark';
import { ABOUT_PRIMARY_BUTTON } from '../aboutStyles';

interface Props {
    readonly title: string;
    readonly lede: string;
    readonly button: string;
    /** The chat home of the page locale. */
    readonly href: string;
}

/** The page's opening: the brand mark, the h1, a lede and the way into the chat. */
export function AboutHero({ title, lede, button, href }: Props) {
    return (
        <section className="flex flex-col items-center pt-12 pb-8 text-center sm:pt-16">
            <SiglensMark size="lg" className="mb-5" />
            <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                {title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                {lede}
            </p>
            <a href={href} className={cn(ABOUT_PRIMARY_BUTTON, 'mt-6')}>
                {button}
            </a>
        </section>
    );
}
