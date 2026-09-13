import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { BetaBadge } from '@/shared/ui/BetaBadge';
import {
    ArrowUpRightIcon,
    CandlesIcon,
    GlobeIcon,
    NewsIcon,
    QuoteIcon,
    SparkIcon,
} from './icons';
import { SiglensMark } from './SiglensMark';

interface Props {
    readonly onPick: (text: string) => void;
    readonly signedIn: boolean;
    readonly loginHref: string;
    /** AI-generated suggestions for this hour (spec §4-3); `null`/empty falls back to the static six. */
    readonly suggestions?: readonly string[] | null;
}

interface CapabilityItem {
    readonly Icon: ComponentType<{ className?: string }>;
    readonly label: string;
}

/** Suggestion card: a quiet surface that lifts to the brand colour on hover — content, not a filter chip. */
const CARD =
    'group flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-border-control bg-secondary-800 px-4 py-3 text-left text-sm leading-5 text-secondary-200 transition-colors hover:border-primary-400 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';

/**
 * First screen of a new conversation, and the landing page crawlers index.
 * It carries the siglens identity the rest of the chat is quiet about: the
 * logo tile, the mono `SIGLENS AI` eyebrow with the Beta tag, the two-tone
 * headline the main site's hero uses, and a faint chart grid behind it.
 * Then what the assistant can reach, and questions to start from — sendable
 * for members, a path to login for guests.
 */
export function EmptyState({
    onPick,
    signedIn,
    loginHref,
    suggestions,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    // Localized fallback — kept inside the component (not hoisted) so the
    // extraction codemod can find them as real `t()` calls.
    const fallback = [
        t('EmptyState.suggestionPortfolio'),
        t('EmptyState.suggestionSamsung'),
        t('EmptyState.suggestionAapl'),
        t('EmptyState.suggestionNews'),
        t('EmptyState.suggestionNvda'),
        t('EmptyState.suggestionBtc'),
    ];
    const items =
        signedIn && suggestions && suggestions.length > 0
            ? suggestions
            : fallback;
    const capabilities: readonly CapabilityItem[] = [
        { Icon: QuoteIcon, label: t('EmptyState.capQuotes') },
        { Icon: CandlesIcon, label: t('EmptyState.capIndicators') },
        { Icon: SparkIcon, label: t('EmptyState.capAnalysis') },
        { Icon: NewsIcon, label: t('EmptyState.capNews') },
        { Icon: GlobeIcon, label: t('EmptyState.capWeb') },
    ];
    return (
        <div className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 sm:py-16">
            {/* Chart-paper grid fading out from the top, plus a low brand glow —
                the atmosphere of the main site's hero, kept faint enough that
                the questions stay the loudest thing on screen. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(to_right,var(--color-secondary-700)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-secondary-700)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)] bg-[size:44px_44px] opacity-50"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-1/2 -z-10 h-72 w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary-500/15 blur-3xl"
            />
            <div className="w-full max-w-3xl">
                <div className="flex flex-col items-center text-center">
                    <SiglensMark size="lg" className="mb-5" />
                    <p className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.2em] text-primary-400 uppercase">
                        <span translate="no">Siglens AI</span>
                        <BetaBadge />
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-4xl">
                        {t('EmptyState.headlineLead')}
                        <span className="block text-primary-400">
                            {t('EmptyState.headlineAccent')}
                        </span>
                    </h1>
                    <p className="mt-4 max-w-xl text-[15px] leading-6 text-pretty text-secondary-300">
                        {t('EmptyState.description')}
                    </p>
                    <ul
                        aria-label={t('EmptyState.capabilitiesLabel')}
                        className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-secondary-400"
                    >
                        {capabilities.map(({ Icon, label }) => (
                            <li
                                key={label}
                                className="inline-flex items-center gap-1.5"
                            >
                                <Icon className="size-3.5 text-primary-400" />
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>
                {signedIn ? null : (
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <a
                            href={loginHref}
                            className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('EmptyState.a00741')}
                        </a>
                        <p className="text-xs text-secondary-400">
                            {t('EmptyState.guestNote')}
                        </p>
                    </div>
                )}
                <h2 className="mt-10 mb-3 text-center text-xs font-medium text-secondary-400">
                    {signedIn
                        ? t('EmptyState.suggestionsLabel')
                        : t('EmptyState.examplesLabel')}
                </h2>
                <ul
                    aria-label={
                        signedIn
                            ? t('EmptyState.suggestionsLabel')
                            : t('EmptyState.examplesLabel')
                    }
                    className="grid w-full gap-2 sm:grid-cols-2"
                >
                    {items.map((s, i) => (
                        // Index in the key: AI-generated strings carry no uniqueness
                        // guarantee at this boundary, and a collision would silently
                        // drop a card.
                        <li key={`${i}-${s}`}>
                            {signedIn ? (
                                <button
                                    type="button"
                                    onClick={() => onPick(s)}
                                    className={CARD}
                                >
                                    <span className="line-clamp-2 min-w-0 break-words">
                                        {s}
                                    </span>
                                    <ArrowUpRightIcon className="size-4 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                                </button>
                            ) : (
                                <a href={loginHref} className={CARD}>
                                    <span className="line-clamp-2 min-w-0 break-words">
                                        {s}
                                    </span>
                                    <ArrowUpRightIcon className="size-4 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
