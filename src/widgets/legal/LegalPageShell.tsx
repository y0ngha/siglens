import { cn } from '@/shared/lib/cn';
import { LegalBreadcrumb } from './LegalBreadcrumb';
import type { TocItem } from '@/shared/lib/legal-toc';
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
            <main className="page-container flex flex-1 flex-col items-center py-12 sm:py-16">
                <article className="w-full max-w-3xl">
                    <LegalBreadcrumb pageTitle={breadcrumbTitle} />

                    <header className="border-b border-secondary-800 pb-8">
                        <p className="font-mono text-xs tracking-widest text-primary-400 uppercase">
                            {eyebrow}
                        </p>
                        <h1 className="mt-3 text-3xl font-bold text-secondary-100 sm:text-4xl">
                            {title}
                        </h1>
                        <p className="mt-4 text-sm leading-relaxed text-secondary-400 sm:text-base">
                            {intro}
                        </p>
                        <p className="mt-4 text-xs text-secondary-500">
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
                        <p className="mb-3 text-xs font-semibold tracking-wider text-secondary-400 uppercase">
                            목차
                        </p>
                        <ol className="space-y-2 text-sm">
                            {toc.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={`#${item.id}`}
                                        className="text-secondary-300 transition-colors hover:text-primary-400"
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
        </>
    );
}
