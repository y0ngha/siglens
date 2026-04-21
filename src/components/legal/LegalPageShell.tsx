import { cn } from '@/lib/cn';
import { Footer } from '@/components/layout/Footer';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import type { TocItem } from '@/components/legal/PolicySection';
import type { ReactNode } from 'react';

interface LegalPageShellProps {
    breadcrumbTitle: string;
    eyebrow: string;
    title: string;
    intro: ReactNode;
    effectiveDate: string;
    toc: readonly TocItem[];
    topNotice?: ReactNode;
    bottomNotice?: ReactNode;
    children: ReactNode;
}

export function LegalPageShell({
    breadcrumbTitle,
    eyebrow,
    title,
    intro,
    effectiveDate,
    toc,
    topNotice,
    bottomNotice,
    children,
}: LegalPageShellProps) {
    return (
        <>
            <main className="flex flex-1 flex-col items-center px-6 py-12 sm:py-16">
                <article className="w-full max-w-3xl">
                    <LegalBreadcrumb pageTitle={breadcrumbTitle} />

                    <header className="border-secondary-800 border-b pb-8">
                        <p className="text-primary-400 font-mono text-xs tracking-widest uppercase">
                            {eyebrow}
                        </p>
                        <h1 className="text-secondary-100 mt-3 text-3xl font-bold sm:text-4xl">
                            {title}
                        </h1>
                        <p className="text-secondary-400 mt-4 text-sm leading-relaxed sm:text-base">
                            {intro}
                        </p>
                        <p className="text-secondary-500 mt-4 text-xs">
                            시행일: {effectiveDate}
                        </p>
                    </header>

                    {topNotice}

                    <nav
                        aria-label="목차"
                        className={cn(
                            'border-secondary-800 bg-secondary-900/40 mb-8 rounded-lg border p-5',
                            topNotice ? undefined : 'mt-8'
                        )}
                    >
                        <p className="text-secondary-400 mb-3 text-xs font-semibold tracking-wider uppercase">
                            목차
                        </p>
                        <ol className="space-y-2 text-sm">
                            {toc.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={`#${item.id}`}
                                        className="text-secondary-300 hover:text-primary-400 transition-colors"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <div className="space-y-8">{children}</div>

                    {bottomNotice}
                </article>
            </main>
            <Footer />
        </>
    );
}
