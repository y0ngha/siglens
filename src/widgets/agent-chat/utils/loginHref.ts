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
