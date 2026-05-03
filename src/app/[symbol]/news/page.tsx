import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    getNewsList,
    getGradeEvents,
    getNextEarningsCalendar,
    getLatestEarningsReport,
} from '@/app/[symbol]/news/newsData';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { NewsList } from '@/components/news/sections/NewsList';
import { EventCalendar } from '@/components/news/sections/EventCalendar';
import { AnalystActions } from '@/components/news/sections/AnalystActions';
import { NewsAiSummary } from '@/components/news/NewsAiSummary';
import { NewsAiSummarySkeleton } from '@/components/news/NewsAiSummarySkeleton';
import { NewsAiSummaryError } from '@/components/news/NewsAiSummaryError';
import { ErrorBoundary } from 'react-error-boundary';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    buildBreadcrumbJsonLd,
    buildSymbolNewsSeoContent,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
} from '@/lib/seo';
import { waitUntil } from '@vercel/functions';
import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const { title, fullTitle, description, url, keywords } =
        buildSymbolNewsSeoContent(upper);

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

interface SymbolSectionProps {
    symbol: string;
}

async function NewsListSection({ symbol }: SymbolSectionProps) {
    const items = await getNewsList(symbol);
    return <NewsList items={items} />;
}

async function EventCalendarSection({ symbol }: SymbolSectionProps) {
    const today = todayKstIsoDate();
    const [nextEarnings, latestReport] = await Promise.all([
        getNextEarningsCalendar(symbol, today),
        getLatestEarningsReport(symbol),
    ]);
    return (
        <EventCalendar
            nextEarnings={nextEarnings}
            latestReport={latestReport}
        />
    );
}

async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    const events = await getGradeEvents(symbol);
    return <AnalystActions events={events} />;
}

function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="bg-secondary-700 h-32 animate-pulse rounded-xl"
        />
    );
}

export default async function NewsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // waitUntil keeps the serverless function alive past response completion so the analysis settles without blocking the stream.
    waitUntil(
        ensureNewsCardsAnalyzedAction(upper).catch((error: unknown) => {
            console.error(
                '[NewsPage] ensureNewsCardsAnalyzedAction failed:',
                error
            );
        })
    );

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: `/${upper}` },
        { name: '뉴스 분석', url: `/${upper}/news` },
    ]);

    return (
        <>
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <ErrorBoundary FallbackComponent={NewsAiSummaryError}>
                    <Suspense fallback={<NewsAiSummarySkeleton />}>
                        <NewsAiSummary symbol={upper} />
                    </Suspense>
                </ErrorBoundary>

                <Suspense fallback={<SectionSkeleton />}>
                    <NewsListSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <EventCalendarSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <AnalystActionsSection symbol={upper} />
                </Suspense>

                <CrossLinkCards symbol={upper} current="news" />
            </main>
        </>
    );
}
