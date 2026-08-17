import { SITE_NAME } from '@/shared/lib/seo';
import Image from 'next/image';
import type { ReactNode } from 'react';

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
        <main className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden bg-secondary-950 px-4 py-12">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 -left-40 h-144 w-xl rounded-full bg-primary-600/15 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.35)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_75%)] bg-size-[48px_48px] opacity-30" />
            </div>
            <section className="relative w-full max-w-md rounded-2xl bg-secondary-900/80 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-secondary-800 backdrop-blur-xl motion-safe:animate-[fade-up_220ms_ease-out]">
                <header className="mb-8 flex flex-col items-start gap-5">
                    <div className="flex items-center gap-2">
                        {/*
                            Use the 96×96 PNG (not icon24) because a 24→32 upscale
                            on a logo with sharp edges produces visible blurriness
                            on 1× DPI displays; the auth page is not LCP-sensitive
                            so the extra bytes are fine.
                        */}
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
                            className="font-mono text-sm font-semibold tracking-[0.2em] text-secondary-100 uppercase"
                        >
                            {SITE_NAME}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-secondary-50">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="mt-1 text-sm text-secondary-400">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </header>
                {children}
                {footer ? (
                    <footer className="mt-6 text-sm text-secondary-400">
                        {footer}
                    </footer>
                ) : null}
            </section>
        </main>
    );
}
