import { useTranslations } from 'next-intl';

export function EmptyState({
    onPick,
    signedIn,
    loginHref,
}: {
    readonly onPick: (text: string) => void;
    readonly signedIn: boolean;
    readonly loginHref: string;
}) {
    const t = useTranslations('widgets.agent-chat');
    // Localized per-locale suggestions — kept inside the component (not
    // hoisted) so the extraction codemod can find them as real `t()` calls.
    const suggestions = [
        t('EmptyState.suggestionPortfolio'),
        t('EmptyState.suggestionSamsung'),
        t('EmptyState.suggestionAapl'),
        t('EmptyState.suggestionNews'),
        t('EmptyState.suggestionNvda'),
        t('EmptyState.suggestionBtc'),
    ];
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
            <h1 className="text-2xl font-semibold text-secondary-100">
                {t('EmptyState.aea068')}
            </h1>
            <p className="max-w-md text-sm text-secondary-300">
                {t('EmptyState.a12848')}
            </p>
            {signedIn ? (
                <ul className="grid w-full gap-2 sm:grid-cols-2">
                    {suggestions.map(s => (
                        <li key={s}>
                            <button
                                type="button"
                                onClick={() => onPick(s)}
                                className="w-full rounded-lg border border-border-control bg-secondary-800 px-3 py-2 text-left text-sm text-secondary-200 hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                {s}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <a
                    href={loginHref}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                    {t('EmptyState.a00741')}
                </a>
            )}
        </div>
    );
}
