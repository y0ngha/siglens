import Image from 'next/image';
import type { ReactNode } from 'react';
import { SITE_NAME } from '@/lib/seo';

interface AuthCardShellProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
}

export function AuthCardShell({
    title,
    subtitle,
    children,
    footer,
}: AuthCardShellProps) {
    return (
        <main className="bg-secondary-950 relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-12">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-blue-600/15 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.35)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[size:48px_48px] opacity-30" />
            </div>
            <section className="ring-secondary-800 bg-secondary-900/80 relative w-full max-w-md rounded-2xl p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 backdrop-blur-xl motion-safe:animate-[fade-up_220ms_ease-out]">
                <header className="mb-8 flex flex-col items-start gap-5">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/icon96.png"
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="h-8 w-8"
                        />
                        <span
                            translate="no"
                            className="text-secondary-100 font-mono text-sm font-semibold tracking-[0.2em] uppercase"
                        >
                            {SITE_NAME}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-secondary-50 text-2xl font-semibold">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="text-secondary-400 mt-1 text-sm">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </header>
                {children}
                {footer ? (
                    <footer className="text-secondary-400 mt-6 text-sm">
                        {footer}
                    </footer>
                ) : null}
            </section>
        </main>
    );
}
