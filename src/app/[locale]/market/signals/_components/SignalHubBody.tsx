import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import {
    CROSS_LOOKBACK_BARS,
    GOLDEN_CROSS_FAST_PERIOD,
    GOLDEN_CROSS_SLOW_PERIOD,
    SHORT_MA_CROSS_FAST_PERIOD,
    SHORT_MA_CROSS_SLOW_PERIOD,
} from '@y0ngha/siglens-core';
import { loadGuideCatalog } from '@/entities/guide/api';
import { isMailAlertLaunched } from '@/entities/mail-alert/lib/mailAlertConstants';
import { SIGNAL_HUB_MARKET_ORDER } from '@/entities/signal-history/lib/signalHubRows';
import {
    SIGNAL_HUBS,
    signalHubPath,
    type SignalHub,
} from '@/entities/signal-history/lib/signalHubs';
import type {
    SignalEpisodeRow,
    SignalHistoryMarket,
} from '@/entities/signal-history/types';
import { SIGNAL_SCAN_UNIVERSE_SIZE } from '@/shared/config/signalScanUniverse/signalScanUniverse';
import type { Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
} from '@/shared/lib/legal';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_URL,
} from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { MailAlertCard } from '@/features/mail-alert/ui/MailAlertCard';
import { SignalHubLinks } from '@/widgets/signal-hubs/SignalHubLinks';
import { isSignalHubDataIndexable } from '../_lib/isSignalHubDataIndexable';
import { loadSignalHub } from '../_lib/loadSignalHub';
import { signalHubCopy } from '../_lib/signalHubCopy';
import { buildSignalHubItemListJsonLd } from '../_lib/signalHubItemListJsonLd';
import { SignalHubRowItem } from './SignalHubRowItem';

const MARKET_PATH = '/market';

/** 골든·데드크로스 정의 문구의 숫자 — 판정에 쓰는 core 상수 그대로(50/200, 최근 3봉, 단기 교차 20/50). */
const DEFINITION_VALUES = {
    bars: CROSS_LOOKBACK_BARS,
    fast: GOLDEN_CROSS_FAST_PERIOD,
    slow: GOLDEN_CROSS_SLOW_PERIOD,
    shortFast: SHORT_MA_CROSS_FAST_PERIOD,
    shortSlow: SHORT_MA_CROSS_SLOW_PERIOD,
} as const;

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
 * 메타데이터가 색인을 허용할 때만 낸다(같은 함수 `isSignalHubDataIndexable`) — noindex 렌더에 "정식 목록"
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
    const indexable = isSignalHubDataIndexable(data);
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
                        data={buildSignalHubItemListJsonLd(
                            copy.itemListName,
                            data.rows,
                            locale
                        )}
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
                        {t('intro', {
                            signal: copy.signalLabel,
                            usCount: SIGNAL_SCAN_UNIVERSE_SIZE.us,
                            krCount: SIGNAL_SCAN_UNIVERSE_SIZE.kr,
                        })}
                    </p>
                    {hub.definitionKey !== undefined && (
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-secondary-300">
                            {/* 키를 리터럴로 적어야 추출기가 두 키를 모두 읽는다. 숫자는 core 상수라 판정과 문구가 어긋나지 않는다. */}
                            {hub.definitionKey === 'definitionGoldenCross'
                                ? t('definitionGoldenCross', DEFINITION_VALUES)
                                : t('definitionDeathCross', DEFINITION_VALUES)}
                        </p>
                    )}

                    {/* 소개 문단 뒤, 가이드 앞. 공개 전에는 그리지 않는다. */}
                    {isMailAlertLaunched() && (
                        <div className="mt-6">
                            <MailAlertCard
                                target={{
                                    kind: 'signal',
                                    signalType: hub.signalType,
                                    hubName: copy.signalLabel,
                                }}
                            />
                        </div>
                    )}

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
                            {SIGNAL_HUB_MARKET_ORDER.map(market => {
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
                                        {data.counts[market] > rows.length && (
                                            <p className="mt-1 text-xs text-secondary-400">
                                                {t('truncated', {
                                                    total: data.counts[market],
                                                    shown: rows.length,
                                                })}
                                            </p>
                                        )}
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
                                                            <SignalHubRowItem
                                                                key={row.symbol}
                                                                row={row}
                                                                locale={locale}
                                                                lastSeenLabel={
                                                                    row.lastSeenSession ===
                                                                    row.sessionDate
                                                                        ? null
                                                                        : t(
                                                                              'lastSeen',
                                                                              {
                                                                                  date: formatSessionDate(
                                                                                      row.lastSeenSession,
                                                                                      locale
                                                                                  ),
                                                                              }
                                                                          )
                                                                }
                                                            />
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
