---
name: next-intl-usetranslations-bare-call
description: useTranslations (client hook) throws "Invalid hook call" when a component is invoked as a bare function in vitest without React's render() — use getTranslations instead for components tests call directly.
metadata:
  type: reference
---

In siglens (next-intl + vitest), some test files call a Server Component
directly as a plain function (e.g. `MarketRouteBody({ scope })`) instead of
`render()`-ing it, specifically so they can inspect the returned React
element tree or mock-call side effects synchronously without a DOM. See
`src/app/[locale]/market/__tests__/page.test.ts` /
`src/app/[locale]/market/kr/__tests__/page.test.ts`.

`useTranslations` (imported from `'next-intl'`, the client entry) is a real
`useContext` hook. It only works when React's hook dispatcher is active —
i.e. inside an actual render pass (`render()` from testing-library, or real
Next.js RSC rendering). Called as a bare function with no render pass, it
throws `Invalid hook call` / `Failed to call useTranslations because the
context from NextIntlClientProvider was not found`.

`getTranslations` (imported from `'next-intl/server'`) is an async function,
not a hook — it works fine when called directly, no render pass needed
(vitest.config.ts aliases `next-intl/server` to the react-server build).

**Rule of thumb**: if a Server Component might be unit-tested by calling it
as a bare function (check for that pattern before touching the file), use
`getTranslations` inside it (making the component `async`), not
`useTranslations`. If it's only ever tested via `render()`, either works —
`useTranslations` is fine there (confirmed via `FearGreedRouteBody`, which
uses it and is only exercised through `render(await FearGreedRoutePage(...))`).

See [[project_i18n_shared_seo_translator_threading]] for the broader task
this came up in.
