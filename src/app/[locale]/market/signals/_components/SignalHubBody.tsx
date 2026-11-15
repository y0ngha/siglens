import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { loadGuideCatalog } from '@/entities/guide/api';
import {
    isSignalHubIndexable,
    SIGNAL_HUBS,
    signalHubPath,
    type SignalHub,
} from '@/entities/signal-history/lib/signalHubs';
import type {
    SignalEpisodeRow,
    SignalHistoryMarket,
} from '@/entities/signal-history/types';
import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
} from '@/shared/lib/legal';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    localizedAbsoluteUrl,
    SITE_URL,
} from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SignalHubLinks } from '@/widgets/signal-hubs/SignalHubLinks';
import { loadSignalHub } from '../_lib/loadSignalHub';
import { signalHubCopy } from '../_lib/signalHubCopy';

const MARKETS: readonly SignalHistoryMarket[] = ['us', 'kr'];
const MARKET_PATH = '/market';

function rowLabel(row: SignalEpisodeRow, locale: Locale): string {
    // 한글 이름은 ko에서만 쓴다 — 다른 로케일에 한글을 섞지 않는다(홈·가이드 목록과 같은 규칙).
    return row.koreanName !== null && locale === DEFAULT_LOCALE
        ? row.koreanName
        : row.symbol.replace(KR_EXCHANGE_SUFFIX_RE, '');
}

/** 처음 포착 세션별로 묶는다(이미 최신순으로 온다). */
function groupBySession(
    rows: readonly SignalEpisodeRow[]
): { readonly sessionDate: string; readonly rows: SignalEpisodeRow[] }[] {
    const dates = [...new Set(rows.map(row => row.sessionDate))];
    return dates.map(sessionDate => ({
        sessionDate,
        rows: rows.filter(row => row.sessionDate === sessionDate),
    }));
}

function formatSessionDate(isoDate: string, locale: Locale): string {
    // 세션 날짜는 `YYYY-MM-DD`(시각 없음)라 UTC 자정으로 읽고 KST로 찍어도 날짜가 바뀌지 않는다.
    return formatKoreanDate(new Date(isoDate), locale);
}

interface SignalHubBodyProps {
    readonly hub: SignalHub;
    readonly locale: Locale;
}

/**
 * `/market/signals/[signal]` 본문 — 최근 30일 동안 이 신호가 처음 포착된 미국·한국 종목.
 *
 * 전부 서버 렌더다(Suspense 없음) — JS 없는 크롤러도 목록과 종목 링크를 읽는다. 구조화데이터는
 * 메타데이터가 색인을 허용할 때만 낸다(같은 술어 `isSignalHubIndexable`) — noindex 렌더에 "정식 목록"
 * 마크업을 붙이면 색인 지시와 어긋난다.
 */
export async function SignalHubBody({
    hub,
    locale,
}: SignalHubBodyProps): Promise<ReactElement> {
    const [t, tLabel, tLegal, copy, data, catalog] = await Promise.all([
        getTranslations('app.market.signalHub'),
        getTranslations('shared.enumLabel'),
        getTranslations('shared.lib.legal'),
        signalHubCopy(hub),
        loadSignalHub(hub.signalType),
        loadGuideCatalog(locale),
    ]);
    const indexable = !data.degraded && isSignalHubIndexable(data.rows.length);
    const url = `${SITE_URL}${copy.path}`;
    const guideEntry =
        catalog?.entries.find(
            entry =>
                entry.category === hub.guide.category &&
                entry.slug === hub.guide.slug
        ) ?? null;
    const marketLabel: Record<SignalHistoryMarket, string> = {
        us: t('marketUs'),
        kr: t('marketKr'),
    };

    return (
        <>
            {indexable && (
                <>
                    <JsonLd
                        data={buildWebPageJsonLd({
                            url,
                            name: brandTitle(copy.title, locale),
                            description: copy.description,
                            locale,
                        })}
                    />
                    <JsonLd
                        data={buildBreadcrumbJsonLd(
                            [
                                {
                                    name: t('breadcrumbMarket'),
                                    url: `${SITE_URL}${MARKET_PATH}`,
                                },
                                { name: copy.title, url },
                            ],
                            locale
                        )}
                    />
                    <JsonLd
                        data={{
                            '@context': 'https://schema.org',
                            '@type': 'ItemList',
                            name: copy.itemListName,
                            itemListElement: data.rows.map((row, index) => ({
                                '@type': 'ListItem',
                                position: index + 1,
                                name: `${rowLabel(row, locale)} (${row.symbol})`,
                                // noindex인 비인기 종목 페이지는 URL을 싣지 않는다(시장 페이지와 같은 규칙).
                                ...(isPopularSymbol(row.symbol) && {
                                    url: localizedAbsoluteUrl(
                                        `${SITE_URL}/${row.symbol}`,
                                        locale
                                    ),
                                }),
                            })),
                        }}
                    />
                </>
            )}
            <main className="flex-1">
                <div className="page-container pt-6 pb-16">
                    {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList의 `name`과 같아야 한다. */}
                    <Breadcrumb
                        trail={[
                            { label: t('breadcrumbMarket'), href: MARKET_PATH },
                            { label: copy.title },
                        ]}
                    />
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                        {copy.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary-300">
                        {t('intro', { signal: copy.signalLabel })}
                    </p>

                    {guideEntry !== null && (
                        <section
                            aria-labelledby="signal-hub-guide-heading"
                            className={cn(SURFACE_CARD, 'mt-6 p-5')}
                        >
                            <h2
                                id="signal-hub-guide-heading"
                                className={HEADING_SECTION}
                            >
                                {t('guideHeading', {
                                    signal: copy.signalLabel,
                                })}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-secondary-300">
                                {guideEntry.summary}
                            </p>
                            <Link
                                href={guideEntryPath(
                                    guideEntry.category,
                                    guideEntry.slug
                                )}
                                prefetch={false}
                                className="mt-3 inline-block text-sm font-medium text-primary-400 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {t('guideLink', { title: guideEntry.title })} →
                            </Link>
                        </section>
                    )}

                    {data.degraded ? (
                        <p className="mt-8 text-sm text-secondary-400">
                            {t('degraded')}
                        </p>
                    ) : (
                        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                            {MARKETS.map(market => {
                                const rows = data.rows.filter(
                                    row => row.market === market
                                );
                                const headingId = `signal-hub-${market}-heading`;
                                return (
                                    <section
                                        key={market}
                                        aria-labelledby={headingId}
                                    >
                                        <h2
                                            id={headingId}
                                            className={HEADING_SECTION}
                                        >
                                            {marketLabel[market]}
                                        </h2>
                                        {rows.length === 0 ? (
                                            <p className="mt-3 text-sm text-secondary-400">
                                                {t('empty')}
                                            </p>
                                        ) : (
                                            groupBySession(rows).map(group => (
                                                <div
                                                    key={group.sessionDate}
                                                    className="mt-4"
                                                >
                                                    <h3 className="text-xs font-semibold text-secondary-400">
                                                        {t('firstSeen', {
                                                            date: formatSessionDate(
                                                                group.sessionDate,
                                                                locale
                                                            ),
                                                        })}
                                                    </h3>
                                                    <ul className="mt-1 divide-y divide-secondary-700">
                                                        {group.rows.map(row => (
                                                            <li
                                                                key={row.symbol}
                                                                className="flex items-center justify-between gap-3 py-2"
                                                            >
                                                                <div className="min-w-0">
                                                                    <Link
                                                                        href={`/${row.symbol}`}
                                                                        prefetch={
                                                                            false
                                                                        }
                                                                        className="block truncate text-sm font-medium text-secondary-100 underline-offset-4 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                                                    >
                                                                        {rowLabel(
                                                                            row,
                                                                            locale
                                                                        )}
                                                                    </Link>
                                                                    {row.lastSeenSession !==
                                                                        row.sessionDate && (
                                                                        <p className="mt-0.5 text-xs text-secondary-400">
                                                                            {t(
                                                                                'lastSeen',
                                                                                {
                                                                                    date: formatSessionDate(
                                                                                        row.lastSeenSession,
                                                                                        locale
                                                                                    ),
                                                                                }
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span
                                                                    className={cn(
                                                                        'shrink-0 font-mono text-xs',
                                                                        signColorClass(
                                                                            row.changePercent
                                                                        )
                                                                    )}
                                                                >
                                                                    {formatSignedPercent(
                                                                        row.changePercent
                                                                    )}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}

                    <SignalHubLinks
                        heading={t('otherSignals')}
                        headingId="signal-hub-others-heading"
                        className="mt-12"
                        links={SIGNAL_HUBS.filter(
                            other => other.slug !== hub.slug
                        ).map(other => ({
                            href: signalHubPath(other.slug),
                            label: t('signalStocks', {
                                signal: tLabel(
                                    `signalType.${other.signalType}`
                                ),
                            }),
                        }))}
                    />

                    <p className="mt-10 text-xs leading-relaxed text-secondary-500">
                        {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                    </p>
                </div>
            </main>
        </>
    );
}
