/** The `/about` hero: eyebrow, the page's only h1, and the lede. */

interface AboutHeroProps {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
}

/**
 * Headline and lede only — the site header already carries search, so the
 * hero adds no input of its own.
 */
export function AboutHero({ eyebrow, title, lede }: AboutHeroProps) {
    return (
        <section className="pb-10">
            <p className="text-sm font-medium text-secondary-400">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                {lede}
            </p>
        </section>
    );
}
