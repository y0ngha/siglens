import type { FaqItem } from '@/shared/lib/seo';
import { AboutSection } from '../AboutSection';

interface Props {
    readonly title: string;
    /** The same array the route's `FAQPage` JSON-LD is built from. */
    readonly items: readonly FaqItem[];
}

/**
 * The FAQ as native `<details>` disclosures: the answers are in the server
 * HTML (the JSON-LD requires them on the page) and open without JavaScript.
 */
export function AboutFaqSection({ title, items }: Props) {
    return (
        <AboutSection id="about-faq" title={title}>
            <div className="mt-6 divide-y divide-secondary-700 border-y border-secondary-700">
                {items.map(({ question, answer }) => (
                    <details key={question} className="group">
                        <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded text-[15px] font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                            {question}
                            <span
                                aria-hidden="true"
                                className="text-lg text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                            >
                                +
                            </span>
                        </summary>
                        <p className="max-w-2xl pb-4 text-sm leading-6 text-secondary-300">
                            {answer}
                        </p>
                    </details>
                ))}
            </div>
        </AboutSection>
    );
}
