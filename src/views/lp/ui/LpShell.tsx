import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SITE_URL } from '@/shared/lib/seo';

export const LP_PRIMARY_BUTTON =
    'inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none';

export const LP_DISCLAIMER =
    '투자 권유가 아닌 참고용 정보입니다. 투자 판단은 본인 책임입니다.';

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
 * home page mentions crypto too (spec `2026-09-26-ad-landing-pages-design.md`).
 */
export function LpShell({ selfHref, cta, ctaHref, children }: LpShellProps) {
    return (
        <>
            <header className="sticky top-0 z-10 border-b border-secondary-700 bg-secondary-900/90 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
                    <a
                        href={selfHref}
                        className="-mx-1 flex min-h-11 items-center rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        translate="no"
                    >
                        SIGLENS
                    </a>
                    <a href={ctaHref} className={cn(LP_PRIMARY_BUTTON, 'px-4')}>
                        {cta}
                    </a>
                </div>
            </header>
            <main className="flex-1 px-4 pb-16">
                <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
            <footer className="border-t border-secondary-700 px-4 py-8 text-sm text-secondary-400">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                    <nav aria-label="약관" className="flex gap-4">
                        <a
                            href={`${SITE_URL}/privacy`}
                            className="hover:text-secondary-200"
                        >
                            개인정보처리방침
                        </a>
                        <a
                            href={`${SITE_URL}/terms`}
                            className="hover:text-secondary-200"
                        >
                            이용약관
                        </a>
                    </nav>
                    <p>{LP_DISCLAIMER}</p>
                </div>
            </footer>
        </>
    );
}

/** Body disclaimer block shared by both landing pages. */
export function LpDisclaimer() {
    return (
        <section
            aria-label="투자 유의사항"
            className="mt-16 rounded-lg border border-secondary-700 px-5 py-4 text-sm leading-6 text-secondary-400"
        >
            SIGLENS가 보여주는 분석과 답변은 공개 데이터를 정리한 참고 자료이며
            특정 종목의 매수나 매도를 권유하지 않습니다. 투자 판단과 그 결과는
            투자자 본인에게 있습니다.
        </section>
    );
}
