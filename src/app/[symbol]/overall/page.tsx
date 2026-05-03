import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
    VALID_TICKER_RE,
} from '@/domain/constants/market';
import type { Timeframe } from '@y0ngha/siglens-core';
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

interface Props {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<{ tf?: string }>;
}

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

// `?tf=` is read into a Client prop; canonical URL excludes it so search engines see one URL per page.
export default async function OverallPage({ params, searchParams }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    const { tf } = await searchParams;
    const timeframe: Timeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;

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
