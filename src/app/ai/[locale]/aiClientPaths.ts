import { CHROME_CLIENT_PATHS } from '@/shared/i18n/clientNamespaces';

/**
 * Client-visible next-intl namespaces for the SiglensAI subtree (spec §9-3).
 *
 * Kept in its own module rather than exported from `layout.tsx` — a Next.js
 * route file may only export the default component (and route config like
 * `dynamic`); any other export throws at build time. Both the layout and
 * `aiClientPaths.test.ts` import this module instead.
 *
 * Includes `CHROME_CLIENT_PATHS` (Task S3): the ai host now renders the same
 * `Header` widget tree as the main site (`AuthSessionHeaderClient`), so it
 * needs the exact same message keys — nav labels, search, theme toggle,
 * locale switcher, logout. That set is generator-maintained
 * (`yarn i18n:extract`) and already proven exhaustive for this component tree
 * by `clientKeyCoverage.test.ts`; hand-picking a subset would silently drift
 * the moment a header dependency starts using a dynamic-key namespace (as
 * `shared.config.nav`/`entities.market-news.category` already do for the nav
 * dropdown) — those don't show up in a static `useTranslations('literal')`
 * scan.
 *
 * Cost, accepted: the ai host's per-locale client message payload grows from
 * ~3.6KB to ~16.6KB (measured against `messages/ko.json` via `pickMessages`).
 * That is the price of one shared header instead of two that drift; the ai
 * host has no ISR/SEO surface, so the first-load-JS regression this repo
 * once had from over-wide namespaces (see `shared/i18n/loadMessages.ts`) does
 * not apply here in the same way.
 */
export const AI_CLIENT_PATHS: readonly string[] = [
    ...CHROME_CLIENT_PATHS,
    'widgets.agent-chat',
    'features.agent-chat',
    'app.ai',
];
