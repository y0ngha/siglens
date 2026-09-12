import { useTranslations } from 'next-intl';

interface Props {
    readonly onPick: (text: string) => void;
    readonly signedIn: boolean;
    readonly loginHref: string;
    /** AI-generated suggestions for this hour (spec §4-3); `null`/empty falls back to the static six. */
    readonly suggestions?: readonly string[] | null;
}

/**
 * First screen of a new conversation: a greeting, one line on what the
 * assistant can reach, and a grid of questions the user can send with one
 * click. The suggestions are the product's opening move, so they get the
 * card surface rather than chip styling — they are content, not filters.
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
        suggestions && suggestions.length > 0 ? suggestions : fallback;
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-3xl">
                <div className="flex flex-col items-center text-center">
                    <span
                        aria-hidden="true"
                        className="mb-5 flex size-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white select-none"
                    >
                        AI
                    </span>
                    <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-100">
                        {t('EmptyState.aea068')}
                    </h1>
                    <p className="mt-3 max-w-lg text-[15px] leading-6 text-pretty text-secondary-300">
                        {t('EmptyState.a12848')}
                    </p>
                </div>
                {signedIn ? (
                    <ul
                        aria-label={t('EmptyState.suggestionsLabel')}
                        className="mt-8 grid w-full gap-2 sm:grid-cols-2"
                    >
                        {items.map((s, i) => (
                            // Index in the key: AI-generated strings carry no uniqueness
                            // guarantee at this boundary, and a collision would silently
                            // drop a card.
                            <li key={`${i}-${s}`}>
                                <button
                                    type="button"
                                    onClick={() => onPick(s)}
                                    // A button is a control, so its edge is the control border
                                    // (3:1), not the card border a static panel would use.
                                    className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-border-control bg-secondary-800 px-4 py-3 text-left text-sm leading-5 text-secondary-200 hover:bg-secondary-700 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    <span className="line-clamp-2 min-w-0 break-words">
                                        {s}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="shrink-0 text-secondary-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                                    >
                                        →
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="mt-8 flex justify-center">
                        <a
                            href={loginHref}
                            className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('EmptyState.a00741')}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
