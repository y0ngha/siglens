import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OverallContent } from '@/components/overall/OverallContent';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOverallSeoContent,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
} from '@/lib/seo';

/** Regex for valid U.S. ticker symbols: 1–8 uppercase letters or dots. */
const VALID_TICKER_RE = /^[A-Z.]{1,8}$/;

interface Props {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<{ tf?: string }>;
}

/**
 * Generate page-level SEO metadata for `/[symbol]/overall`.
 */
export async function generateMetadata({
    params,
}: Pick<Props, 'params'>): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const { title, fullTitle, description, url, keywords } =
        buildSymbolOverallSeoContent(upper);

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url,
            locale: 'ko_KR',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

/**
 * RSC page: `/[symbol]/overall`.
 *
 * Thin shell that:
 *   1. Validates the symbol parameter.
 *   2. Injects BreadcrumbList JSON-LD for SEO.
 *   3. Mounts the client-side `OverallContent` orchestrator.
 *   4. Renders `CrossLinkCards` for sibling page navigation.
 *
 * The `?tf=` query param forwards the timeframe to the client component;
 * the canonical URL strips it (query params are excluded from `alternates.canonical`).
 */
export default async function OverallPage({ params, searchParams }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    const { tf } = await searchParams;
    const timeframe = tf ?? '1Day';

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: `/${upper}` },
        { name: 'AI 종합 분석', url: `/${upper}/overall` },
    ]);

    return (
        <>
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <OverallContent symbol={upper} timeframe={timeframe} />
                <CrossLinkCards symbol={upper} current="overall" />
            </main>
        </>
    );
}
