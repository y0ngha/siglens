import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    getNewsList,
    getGradeEvents,
    getNextEarningsCalendar,
    getLatestEarningsReport,
    todayKstIsoDate,
} from '@/app/[symbol]/news/newsData';
import { NewsList } from '@/components/news/sections/NewsList';
import { EventCalendar } from '@/components/news/sections/EventCalendar';
import { AnalystActions } from '@/components/news/sections/AnalystActions';
import { NewsAiSummary } from '@/components/news/NewsAiSummary';
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

/** Regex for valid U.S. ticker symbols: 1–8 uppercase letters or dots. */
const VALID_TICKER_RE = /^[A-Z.]{1,8}$/;

interface Props {
    params: Promise<{ symbol: string }>;
}

/**
 * Generate page-level SEO metadata for `/[symbol]/news`.
 */
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

// ─── Thin async RSC wrappers (fetch + pass props) ─────────────────────────────
// These live in app/ so they can call infrastructure-backed data fetchers.
// Each wraps one or more data calls and passes resolved props to the
// presentational component in components/news/sections/.
// Individual Suspense boundaries in the main page allow each to stream
// independently.

async function NewsListSection({ symbol }: { symbol: string }) {
    const items = await getNewsList(symbol);
    return <NewsList items={items} />;
}

async function EventCalendarSection({ symbol }: { symbol: string }) {
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

async function AnalystActionsSection({ symbol }: { symbol: string }) {
    const events = await getGradeEvents(symbol);
    return <AnalystActions events={events} />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="bg-secondary-700 h-32 animate-pulse rounded-xl"
        />
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * RSC page: `/[symbol]/news`.
 *
 * Fire-and-forget: triggers `ensureNewsCardsAnalyzedAction` so that on
 * future loads the news cards will have AI-generated translations +
 * sentiment. The current render always shows whatever is already in the DB.
 *
 * Streams each of the 4 sections independently via Suspense.
 */
export default async function NewsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // Fire-and-forget: fetch fresh news + trigger per-card analysis.
    // Page renders with existing DB data; subsequent loads benefit from
    // newly analysed cards. waitUntil keeps the serverless function alive
    // until the promise settles without blocking the response stream.
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
                {/* AI Summary — Client component, no Suspense needed (renders loading state itself) */}
                <NewsAiSummary symbol={upper} />

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
