import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { FONT_VARIABLE_CLASSES } from '../fontVariables';
import '../globals.css';

/**
 * `app/manifest.ts` is auto-linked on every route, and its name and description
 * mention crypto. An ad reviewer that follows `<link rel="manifest">` would read
 * them, so this subtree drops the link.
 */
export const metadata: Metadata = { manifest: null };

/**
 * Root layout for the ad-only landing pages (`/lp/*`), a sibling of `[locale]`
 * and `ai/[locale]` (spec `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 *
 * Korean only and deliberately bare: no global header/footer, search overlay,
 * nav verticals or `NextIntlClientProvider`. The global chrome carries crypto
 * menu items, and Google Ads (KR) limits ads whose landing page mentions crypto.
 * The Google Ads tag stays so conversions from these pages are still measured.
 */
export default function LandingRootLayout({
    children,
}: {
    readonly children: ReactNode;
}) {
    return (
        <html
            lang="ko"
            className={`${FONT_VARIABLE_CLASSES} h-full antialiased scheme-dark`}
            // THEME_INIT_SCRIPT stamps `data-theme` on <html> before first paint;
            // the server HTML has none, so silence that one expected mismatch.
            suppressHydrationWarning
        >
            <body className="flex min-h-full flex-col bg-secondary-900">
                <Script
                    id="lp-theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
                {children}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
            </body>
        </html>
    );
}
