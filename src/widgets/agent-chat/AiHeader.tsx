'use client';

import { useTranslations } from 'next-intl';
import { logoutAction } from '@/features/auth-logout/actions/logoutAction';

interface Props {
    readonly signedIn: boolean;
    readonly siteUrl: string;
    readonly localePrefix: string;
    readonly currentPath: string;
    readonly onOpenSidebar: () => void;
}

/**
 * Login goes to the MAIN host and comes back through the handoff (spec
 * §9-4, `src/app/api/auth/handoff/route.ts`): `/login?next=` wraps the
 * main-host handoff-issue route, which itself bounces to the ai-host start
 * route for a browser-binding `state` when the login CTA arrives without one
 * — see that route's own doc comment. `next` here stays a same-ai-host path.
 */
export function loginHref(
    siteUrl: string,
    localePrefix: string,
    currentPath: string
): string {
    const handoff = `/api/auth/handoff?to=ai&next=${encodeURIComponent(currentPath)}`;
    return `${siteUrl}${localePrefix}/login?next=${encodeURIComponent(handoff)}`;
}

/** Same chrome grammar as siglens `Header` (h-14, tokens); no model picker in the pilot (R12). */
export function AiHeader({
    signedIn,
    siteUrl,
    localePrefix,
    currentPath,
    onOpenSidebar,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <header className="flex h-14 items-center gap-3 border-b border-border-control px-4">
            <button
                type="button"
                onClick={onOpenSidebar}
                aria-label={t('AiHeader.ac1c4d')}
                className="rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
            >
                ☰
            </button>
            <a
                href={siteUrl}
                className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                <span className="text-sm font-semibold text-secondary-100">
                    siglens
                </span>
                <span className="rounded bg-primary-500/15 px-1.5 py-0.5 text-xs font-medium text-primary-400">
                    SiglensAI
                </span>
            </a>
            <div className="ml-auto flex items-center gap-3 text-sm">
                {signedIn ? (
                    <>
                        <a
                            href={`${siteUrl}${localePrefix}/account`}
                            className="text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                            {t('AiHeader.615212')}
                        </a>
                        <form action={logoutAction}>
                            <button
                                type="submit"
                                className="text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                {t('AiHeader.3879f0')}
                            </button>
                        </form>
                    </>
                ) : (
                    <a
                        href={loginHref(siteUrl, localePrefix, currentPath)}
                        className="text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                        {t('AiHeader.e225a6')}
                    </a>
                )}
            </div>
        </header>
    );
}
