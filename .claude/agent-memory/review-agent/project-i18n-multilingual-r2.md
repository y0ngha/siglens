---
name: project-i18n-multilingual-r2
description: feat/i18n-multilingual R2 code review (siglens-i18n worktree) — all 8 R1 findings verified fixed; new find is that nav Link hrefs still drop locale on click (fix only touched usePathname, not Link)
metadata:
  type: project
---

R2 review of `feat/i18n-multilingual` (worktree `/Users/y0ngha/Project/siglens-i18n`). All 8 items from [[project-i18n-multilingual-r1]] (5 required + 3 recommended) verified fixed correctly and completely — canonical `degraded ? null : undefined` confirmed live in all 9 files, `setRequestLocale` confirmed present + correctly ordered (before `notFound()`/`redirect()`) in all 32 pages + `[symbol]/layout.tsx` via a `find | grep` sweep, `classify()`'s `BlockStatement` guard read directly, `.gitignore` exception confirmed via `git check-ignore -v` (exit 0, not ignored), `localeReady` gate in `symbolIndexabilityMetadata.ts` correctly short-circuits the DB read.

**New required finding (missed by both R1 and R2): header nav `<Link>` elements still drop locale on click.**

R1's finding #5 only caught the `usePathname()` mismatch (broke *active-state highlighting*). The R2 fix (`splitLocalePath(usePathname())`) fixed exactly that symptom and nothing else — but `HeaderMobileMenu.tsx` (`import Link from 'next/link'` line 3, used at line 303) and the sibling `HeaderNavMenu.tsx` (rendered by `HeaderNav.tsx`, 3x `<Link href={...}>` at lines 139/162/188) both render actual navigation `<Link>`s with **unprefixed** hrefs from `NAV_TREE`/`assetClassNav` config (e.g. `/market`), using plain `next/link` instead of the locale-aware `Link` from `@/shared/i18n/navigation`.

This is a *navigation-breaking* bug, more severe than the active-state issue R1 caught: `src/shared/i18n/routing.ts` sets `localeDetection: false` and `LocaleSwitcher.tsx` deliberately sets **no cookie** ("로케일의 단일 소스는 URL이다"), so `src/proxy.ts`'s `intlMiddleware` treats any unprefixed path as the **default locale (ko)** with no fallback. Confirmed via `src/shared/i18n/navigation.ts`'s own comment: "기본 API를 그대로 쓰면 로케일이 조용히 ko로 떨어진다" — literally describing this exact bug. Clicking any header/drawer nav link from `/en/...` silently lands on the ko version at an unprefixed URL. `HeaderMobileMenu.test.tsx` mocks `next/link` and only asserts on the literal unprefixed href, so the suite is green and doesn't catch it (another instance of the "green-suite trap" pattern, see [[project-fear-greed-page-seed-helper-fix]]/[[project-prompt-region-context-r6]]).

Low-risk fix available without re-introducing the test-breaking import: `LocaleSwitcher.tsx` already imports `useLocale` from **`next-intl`** directly (not the `@/shared/i18n/navigation` wrapper that breaks ~70 partial-mock tests) — the same pattern (`useLocale()` + `localePath(locale, href)`) can prefix each `<Link href>` while keeping plain `next/link`, sidestepping the `redirect`-at-module-load problem entirely.

**Minor recommended finding (pre-existing pattern, not a regression):** JSON-LD `WebPage`/`Dataset`/`BreadcrumbList` `url`/`@id` fields in `economy/page.tsx`, `economy/kr/page.tsx`, `news/page.tsx`, `news/us/page.tsx`, and `[symbol]/page.tsx` (via `resolveSymbolSeoContent().url`) remain locale-invariant (always `${SITE_URL}${path}`, no locale prefix) even though `alternates.canonical`/`openGraph.url` in the same files were correctly fixed to be locale-aware this round. Consistent across all touched pages, so likely a deliberate/accepted gap rather than an oversight — flagged as recommended only.
