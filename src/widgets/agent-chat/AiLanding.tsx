'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { GUEST_TURNS_PER_DAY, MEMBER_TURNS_PER_DAY } from './guestTurnLimit';
import { ArrowUpRightIcon } from './icons';

interface Props {
    readonly siteUrl: string;
    readonly localePrefix: string;
}

const SECTION = 'border-t border-secondary-700 pt-8';
const LINK =
    'group inline-flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm text-secondary-200 hover:bg-secondary-800 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * The part of the first screen written for people arriving from search:
 * where answers come from, what works without logging in, a short FAQ and
 * the way into the rest of SIGLENS. It lives on the root rather than on a
 * separate `/landing` page on purpose — one URL collects the header links
 * from every siglens.io page, and two pages chasing "주식 AI 챗봇" would
 * compete with each other. Rendered for everyone (guests, members, bots)
 * so what crawlers index is what visitors see.
 */
export function AiLanding({ siteUrl, localePrefix }: Props) {
    const t = useTranslations('widgets.agent-chat');
    const counts = { guest: GUEST_TURNS_PER_DAY, member: MEMBER_TURNS_PER_DAY };
    const sources = [
        t('Landing.sourceQuotes'),
        t('Landing.sourceIndicators'),
        t('Landing.sourceAnalysis'),
        t('Landing.sourceNews'),
    ];
    const faq = [
        [t('Landing.faq1q'), t('Landing.faq1a')],
        [t('Landing.faq2q'), t('Landing.faq2a')],
        [t('Landing.faq3q'), t('Landing.faq3a', counts)],
        [t('Landing.faq4q'), t('Landing.faq4a')],
        [t('Landing.faq5q'), t('Landing.faq5a')],
    ] as const;
    const links = [
        ['/market', t('Landing.linkMarketUs')],
        ['/market/kr', t('Landing.linkMarketKr')],
        ['/fear-greed', t('Landing.linkFearGreed')],
        ['/news', t('Landing.linkNews')],
        ['/about', t('Landing.linkAbout')],
    ] as const;
    const access = [
        {
            title: t('Landing.guestTitle'),
            items: t('Landing.guestItems', counts).split('|'),
        },
        {
            title: t('Landing.memberTitle'),
            items: t('Landing.memberItems', counts).split('|'),
        },
    ];
    return (
        <div className="mt-14 flex w-full flex-col gap-8 text-left">
            <section aria-labelledby="ai-landing-sources" className={SECTION}>
                <h2 id="ai-landing-sources" className={HEADING_SECTION}>
                    {t('Landing.sourcesTitle')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-secondary-300">
                    {t('Landing.sourcesBody')}
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-secondary-300 sm:grid-cols-2">
                    {sources.map(source => (
                        <li key={source} className="flex gap-2">
                            <span
                                aria-hidden="true"
                                className="mt-2.5 size-1 shrink-0 rounded-full bg-primary-400"
                            />
                            {source}
                        </li>
                    ))}
                </ul>
            </section>
            <section aria-labelledby="ai-landing-access" className={SECTION}>
                <h2 id="ai-landing-access" className={HEADING_SECTION}>
                    {t('Landing.accessTitle')}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {access.map(({ title, items }, i) => (
                        <div
                            key={title}
                            className="rounded-lg border border-secondary-700 bg-secondary-800 p-4"
                        >
                            <h3
                                className={cn(
                                    'text-sm font-semibold',
                                    i === 0
                                        ? 'text-secondary-100'
                                        : 'text-primary-400'
                                )}
                            >
                                {title}
                            </h3>
                            <ul className="mt-2 space-y-1 text-sm leading-6 text-secondary-300">
                                {items.map(item => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
            <section aria-labelledby="ai-landing-faq" className={SECTION}>
                <h2 id="ai-landing-faq" className={HEADING_SECTION}>
                    {t('Landing.faqTitle')}
                </h2>
                <div className="mt-3 divide-y divide-secondary-700">
                    {faq.map(([q, a]) => (
                        <details key={q} className="group py-1">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                {q}
                                <span
                                    aria-hidden="true"
                                    className="text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                >
                                    +
                                </span>
                            </summary>
                            <p className="pb-3 text-sm leading-6 text-secondary-300">
                                {a}
                            </p>
                        </details>
                    ))}
                </div>
            </section>
            <nav aria-labelledby="ai-landing-more" className={SECTION}>
                <h2 id="ai-landing-more" className={HEADING_SECTION}>
                    {t('Landing.moreTitle')}
                </h2>
                <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {links.map(([path, label]) => (
                        <li key={path}>
                            <a
                                href={`${siteUrl}${localePrefix}${path}`}
                                className={cn(LINK, 'w-full')}
                            >
                                {label}
                                <ArrowUpRightIcon className="size-4 shrink-0 text-secondary-400 group-hover:text-primary-400" />
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}
