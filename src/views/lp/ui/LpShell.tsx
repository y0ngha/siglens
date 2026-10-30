/**
 * Page chrome for the ad landing pages: header, `<main>` and footer.
 */
import type { ReactNode } from 'react';
import { SITE_URL } from '@/shared/lib/seo';
import { LpCtaLink } from './LpCtaLink';

const LP_DISCLAIMER =
    '투자 권유가 아닌 참고용 정보입니다. 투자 판단은 본인 책임입니다.';

const FOOTER_LINK =
    'inline-flex min-h-10 items-center rounded hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** The footer's legal links. They live on the main host on both pages. */
const LEGAL_LINKS = [
    { label: '개인정보처리방침', href: `${SITE_URL}/privacy` },
    { label: '이용약관', href: `${SITE_URL}/terms` },
] as const;

interface LpShellProps {
    /** The page's own path. The logo links here, never to the site home. */
    readonly selfHref: string;
    readonly cta: string;
    readonly ctaHref: string;
    readonly children: ReactNode;
}

/**
 * Minimal chrome for the ad landing pages: logo + one CTA, and a footer with
 * the two legal links and a disclaimer.
 *
 * Deliberately not the global `Header`/`Footer`: those carry the crypto menu
 * items on every page, and the logo does not link to the site home because the
 * home page mentions crypto too.
 */
export function LpShell({ selfHref, cta, ctaHref, children }: LpShellProps) {
    return (
        <>
            <header className="surface-bar sticky top-0 z-10 bg-secondary-900/90 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
                    <a
                        href={selfHref}
                        className="-mx-1 flex min-h-11 items-center rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        translate="no"
                    >
                        SIGLENS
                    </a>
                    <LpCtaLink href={ctaHref} className="px-4">
                        {cta}
                    </LpCtaLink>
                </div>
            </header>
            {/* `relative isolate` so a page's decorative backdrop (`-z-10`) sits behind content, not behind `<body>`. */}
            <main className="relative isolate flex-1 px-4 pb-16">
                <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
            <footer className="border-t border-secondary-700 px-4 py-8 text-sm text-secondary-400">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                    <nav aria-label="약관" className="flex gap-4">
                        {LEGAL_LINKS.map(({ label, href }) => (
                            <a key={href} href={href} className={FOOTER_LINK}>
                                {label}
                            </a>
                        ))}
                    </nav>
                    <p>{LP_DISCLAIMER}</p>
                </div>
            </footer>
        </>
    );
}
