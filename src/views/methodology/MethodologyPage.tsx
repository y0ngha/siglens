import type { SkillCounts } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import {
    ABOUT_PATH,
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
    SITE_OPERATOR,
} from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { METHODOLOGY_CHANGELOG } from './lib/methodologyChangelog';

interface Props {
    readonly locale: Locale;
    /** Breadcrumb label, shared with the `BreadcrumbList` JSON-LD. */
    readonly title: string;
    /** 홈·`/about`과 같은 소스(`countSkillFiles`)의 개수. */
    readonly counts: SkillCounts;
    /** `METHODOLOGY_UPDATED_AT`, already formatted for the locale. */
    readonly updatedAt: string;
}

/**
 * 본문 속 링크. `/about`의 `TEXT_LINK`와 같은 모양이되, 이 페이지는 긴 읽을거리라
 * 링크가 문단 사이에 서 있다 — 모바일 터치 영역 44px(`min-h-11`)을 준다.
 */
const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 목차 링크. 밑줄 없이 한 줄에 흐르고, 터치 영역은 44px이다. */
const TOC_LINK =
    'inline-flex min-h-11 items-center rounded px-2 text-sm text-secondary-300 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

const BODY = 'max-w-2xl text-[15px] leading-7 text-secondary-300';

const BULLETS =
    'flex max-w-2xl list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500';

/** 섹션 id 순서가 곧 목차 순서다. `#data` 등은 산문 고지(`AnalysisProvenanceNote`)가 건다. */
const SECTION_IDS = [
    'overview',
    'data',
    'indicators',
    'fear-greed',
    'ai',
    'backtesting',
    'limits',
    'corrections',
    'changelog',
] as const;

type SectionId = (typeof SECTION_IDS)[number];

interface SectionProps {
    readonly id: SectionId;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

function Section({ id, title, sub, children }: SectionProps) {
    return (
        <section aria-labelledby={id} className="mt-16 first:mt-0">
            <h2 id={id} className={cn(HEADING_SECTION, 'scroll-mt-24')}>
                {title}
            </h2>
            {sub ? (
                <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            {children}
        </section>
    );
}

interface DataRow {
    readonly label: string;
    readonly value: string;
}

interface MarketCardProps {
    readonly title: string;
    readonly rows: readonly DataRow[];
}

function MarketCard({ title, rows }: MarketCardProps) {
    return (
        <li className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <dl className="mt-3 flex flex-col gap-2">
                {rows.map(row => (
                    <div
                        key={row.label}
                        className="grid gap-x-4 sm:grid-cols-[7rem_minmax(0,1fr)]"
                    >
                        <dt className="text-xs font-semibold text-secondary-400">
                            {row.label}
                        </dt>
                        <dd className="text-sm leading-6 text-secondary-300">
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </li>
    );
}

interface TermProps {
    readonly term: string;
    readonly body: string;
}

function Term({ term, body }: TermProps) {
    return (
        <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="text-sm font-semibold text-secondary-100">{term}</dt>
            <dd className="text-sm leading-6 text-secondary-300">{body}</dd>
        </div>
    );
}

interface VariantProps {
    readonly title: string;
    readonly body: string;
    readonly href?: string;
    readonly linkLabel?: string;
}

function Variant({ title, body, href, linkLabel }: VariantProps) {
    return (
        <li className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <p className="mt-2 text-sm leading-6 text-secondary-300">{body}</p>
            {href && linkLabel ? (
                <LocaleLink href={href} prefetch={false} className={TEXT_LINK}>
                    {linkLabel}
                </LocaleLink>
            ) : null}
        </li>
    );
}

/**
 * `siglens.io/methodology`: 분석이 어떤 데이터로, 어떤 규칙으로, 누가(무엇이) 쓴
 * 것인지 밝히는 긴 읽을거리(설계 `docs/superpowers/specs/2026-10-04-seo-ymyl-upgrade-design.md` §3).
 *
 * YMYL 신뢰 신호가 목적이라 꾸밈이 없다 — 카드와 목록, 일정한 행간만 쓰고
 * 애니메이션은 없다. 전부 서버 렌더 텍스트라 크롤러가 본문 전체를 받는다.
 * 사실 문장은 모두 코드나 `docs/product/DOMAIN.md`와 대조한 것이고, 대조할 수 없는
 * 주장은 넣지 않았다. 공포·탐욕 가중치는 공개하지 않는다(2026-10-04 사용자 결정).
 */
export async function MethodologyPage({
    locale,
    title,
    counts,
    updatedAt,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'views.methodology',
    });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
    // 변경 이력 키는 배열에서 조회한다 — `views.methodology.changelog`는
    // `manualKeys.json`의 `preserve`에 등록돼 있다.
    const changelog = METHODOLOGY_CHANGELOG.map(entry => ({
        date: entry.date,
        label: formatKoreanDate(
            new Date(`${entry.date}T00:00:00+09:00`),
            locale
        ),
        text: t(`changelog.${entry.key}`),
    }));

    const toc: readonly (readonly [SectionId, string])[] = [
        ['overview', t('overview.title')],
        ['data', t('data.title')],
        ['indicators', t('indicators.title')],
        ['fear-greed', t('fearGreed.title')],
        ['ai', t('ai.title')],
        ['backtesting', t('backtesting.title')],
        ['limits', t('limits.title')],
        ['corrections', t('corrections.title')],
        ['changelog', t('changelog.title')],
    ];

    const steps = [
        [t('overview.step1'), t('overview.step1Body')],
        [t('overview.step2'), t('overview.step2Body')],
        [t('overview.step3'), t('overview.step3Body')],
        [t('overview.step4'), t('overview.step4Body')],
    ] as const;

    const usRows: readonly DataRow[] = [
        { label: t('data.rowBars'), value: t('data.fmp') },
        { label: t('data.rowFinancials'), value: t('data.fmp') },
        { label: t('data.rowNews'), value: t('data.fmp') },
        { label: t('data.rowOther'), value: t('data.usOther') },
        { label: t('data.rowDelay'), value: t('data.delayNone') },
    ];
    const krRows: readonly DataRow[] = [
        { label: t('data.rowBars'), value: t('data.yahoo') },
        { label: t('data.rowFinancials'), value: t('data.yahoo') },
        { label: t('data.rowNews'), value: t('data.naver') },
        { label: t('data.rowOther'), value: t('data.krOther') },
        { label: t('data.rowDelay'), value: t('data.delayKr') },
    ];
    const cryptoRows: readonly DataRow[] = [
        { label: t('data.rowBars'), value: t('data.fmp') },
        { label: t('data.rowNews'), value: t('data.fmp') },
        { label: t('data.rowDelay'), value: t('data.delayCrypto') },
    ];

    const limits = [
        t('limits.wrong'),
        t('limits.past'),
        t('limits.personal'),
        t('limits.variance'),
        t('limits.levels'),
    ];

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <header className="pb-6">
                    <p className="text-sm font-medium text-secondary-400">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        {t('hero.title')}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.lede')}
                    </p>
                </header>

                <nav
                    aria-label={t('toc.label')}
                    className="mb-14 border-y border-secondary-700 py-2"
                >
                    <ul className="flex flex-wrap gap-x-1 gap-y-0">
                        {toc.map(([id, label]) => (
                            <li key={id}>
                                <a href={`#${id}`} className={TOC_LINK}>
                                    {label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <Section
                    id="overview"
                    title={t('overview.title')}
                    sub={t('overview.sub')}
                >
                    <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                        {steps.map(([name, body], i) => (
                            <li
                                key={name}
                                className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex size-7 items-center justify-center rounded-full border border-border-control text-xs font-semibold text-secondary-200 tabular-nums"
                                >
                                    {i + 1}
                                </span>
                                <h3 className={cn(HEADING_SUBSECTION, 'mt-3')}>
                                    {name}
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-secondary-300">
                                    {body}
                                </p>
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section id="data" title={t('data.title')} sub={t('data.sub')}>
                    <ul className="mt-6 flex flex-col gap-3">
                        <MarketCard title={t('data.marketUs')} rows={usRows} />
                        <MarketCard title={t('data.marketKr')} rows={krRows} />
                        <MarketCard
                            title={t('data.marketCrypto')}
                            rows={cryptoRows}
                        />
                    </ul>
                    <div className="mt-4 rounded-lg border border-secondary-700 px-4 py-4 sm:px-5">
                        <h3 className="text-sm font-semibold text-secondary-100">
                            {t('data.freshTitle')}
                        </h3>
                        <ul className={cn(BULLETS, 'mt-2')}>
                            <li>{t('data.freshCaption')}</li>
                            <li>{t('data.freshRefresh')}</li>
                            <li>{t('data.freshOnDemand')}</li>
                        </ul>
                    </div>
                </Section>

                <Section
                    id="indicators"
                    title={t('indicators.title')}
                    sub={t('indicators.sub')}
                >
                    <p className={cn(BODY, 'mt-4')}>{t('indicators.rules')}</p>
                    <p className={cn(BODY, 'mt-3')}>
                        {t('indicators.counts', {
                            indicators: counts.indicators,
                            candles: counts.candlesticks,
                            patterns: counts.patterns,
                            strategies: counts.strategies,
                        })}
                    </p>
                    <h3 className={cn(HEADING_SUBSECTION, 'mt-6')}>
                        {t('indicators.examplesTitle')}
                    </h3>
                    <dl className="mt-3 flex max-w-2xl flex-col gap-3">
                        <Term
                            term={t('indicators.ma')}
                            body={t('indicators.maBody')}
                        />
                        <Term
                            term={t('indicators.rsi')}
                            body={t('indicators.rsiBody')}
                        />
                        <Term
                            term={t('indicators.macd')}
                            body={t('indicators.macdBody')}
                        />
                        <Term
                            term={t('indicators.bollinger')}
                            body={t('indicators.bollingerBody')}
                        />
                    </dl>
                    <LocaleLink
                        href="/backtesting"
                        prefetch={false}
                        className={cn(TEXT_LINK, 'mt-3 text-sm')}
                    >
                        {t('indicators.backtest')}
                    </LocaleLink>
                </Section>

                <Section
                    id="fear-greed"
                    title={t('fearGreed.title')}
                    sub={t('fearGreed.sub')}
                >
                    <p className={cn(BODY, 'mt-4')}>{t('fearGreed.how')}</p>
                    <p className={cn(BODY, 'mt-3')}>{t('fearGreed.labels')}</p>
                    <ul className="mt-6 flex flex-col gap-3">
                        <Variant
                            title={t('fearGreed.symbol')}
                            body={t('fearGreed.symbolBody')}
                        />
                        <Variant
                            title={t('fearGreed.us')}
                            body={t('fearGreed.usBody')}
                            href="/fear-greed"
                            linkLabel={t('fearGreed.linkUs')}
                        />
                        <Variant
                            title={t('fearGreed.kr')}
                            body={t('fearGreed.krBody')}
                            href="/fear-greed/kr"
                            linkLabel={t('fearGreed.linkKr')}
                        />
                        <Variant
                            title={t('fearGreed.crypto')}
                            body={t('fearGreed.cryptoBody')}
                            href="/fear-greed/crypto"
                            linkLabel={t('fearGreed.linkCrypto')}
                        />
                    </ul>
                </Section>

                <Section id="ai" title={t('ai.title')} sub={t('ai.sub')}>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                        <div>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('ai.doTitle')}
                            </h3>
                            <ul className={cn(BULLETS, 'mt-2')}>
                                <li>{t('ai.do1')}</li>
                                <li>{t('ai.do2')}</li>
                                <li>{t('ai.do3')}</li>
                                <li>{t('ai.do4')}</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className={HEADING_SUBSECTION}>
                                {t('ai.dontTitle')}
                            </h3>
                            <ul className={cn(BULLETS, 'mt-2')}>
                                <li>{t('ai.dont1')}</li>
                                <li>{t('ai.dont2')}</li>
                                <li>{t('ai.dont3')}</li>
                                <li>{t('ai.dont4')}</li>
                            </ul>
                        </div>
                    </div>
                    <h3 className={cn(HEADING_SUBSECTION, 'mt-8')}>
                        {t('ai.checkTitle')}
                    </h3>
                    <p className={cn(BODY, 'mt-2')}>{t('ai.check')}</p>
                    <h3 className={cn(HEADING_SUBSECTION, 'mt-6')}>
                        {t('ai.levelsTitle')}
                    </h3>
                    <p className={cn(BODY, 'mt-2')}>{t('ai.levels')}</p>
                </Section>

                <Section id="backtesting" title={t('backtesting.title')}>
                    <p className={cn(BODY, 'mt-4')}>{t('backtesting.body')}</p>
                    <p className={cn(BODY, 'mt-3')}>
                        {t('backtesting.caveat')}
                    </p>
                    <LocaleLink
                        href="/backtesting"
                        prefetch={false}
                        className={cn(TEXT_LINK, 'mt-2 text-sm')}
                    >
                        {t('backtesting.link')}
                    </LocaleLink>
                </Section>

                <Section id="limits" title={t('limits.title')}>
                    <ul className={cn(BULLETS, 'mt-4')}>
                        {limits.map(line => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </Section>

                <Section id="corrections" title={t('corrections.title')}>
                    <p className={cn(BODY, 'mt-4')}>
                        {t('corrections.report')}
                    </p>
                    <p className={cn(BODY, 'mt-3')}>{t('corrections.fix')}</p>
                    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-0 text-sm">
                        <li>
                            <a
                                href={`mailto:${SITE_OPERATOR.email}`}
                                className={TEXT_LINK}
                            >
                                {t('corrections.emailLabel')}
                            </a>
                        </li>
                        <li>
                            <LocaleLink
                                href={ABOUT_PATH}
                                prefetch={false}
                                className={TEXT_LINK}
                            >
                                {t('corrections.aboutLink')}
                            </LocaleLink>
                        </li>
                    </ul>
                </Section>

                <Section
                    id="changelog"
                    title={t('changelog.title')}
                    sub={t('changelog.sub')}
                >
                    <ol className="mt-6 flex max-w-2xl flex-col divide-y divide-secondary-700 border-y border-secondary-700">
                        {changelog.map(item => (
                            <li
                                key={`${item.date}-${item.text}`}
                                className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
                            >
                                <time
                                    dateTime={item.date}
                                    className="text-sm text-secondary-400 tabular-nums"
                                >
                                    {item.label}
                                </time>
                                <p className="text-sm leading-6 text-secondary-300">
                                    {item.text}
                                </p>
                            </li>
                        ))}
                    </ol>
                </Section>

                <p className="mt-14 text-center text-xs text-secondary-400">
                    {t('updated', { date: updatedAt })}
                </p>
                <p
                    role="note"
                    className="mt-3 text-center text-xs leading-relaxed text-secondary-400"
                >
                    {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                </p>
            </div>
        </main>
    );
}
