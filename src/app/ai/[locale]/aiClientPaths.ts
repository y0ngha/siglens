/**
 * Client-visible next-intl namespaces for the SiglensAI subtree (spec §9-3).
 *
 * Kept in its own module rather than exported from `layout.tsx` — a Next.js
 * route file may only export the default component (and route config like
 * `dynamic`); any other export throws at build time. Both the layout and
 * `aiClientPaths.test.ts` import this module instead.
 */
export const AI_CLIENT_PATHS = [
    'widgets.agent-chat',
    'features.agent-chat',
    'app.ai',
] as const;
