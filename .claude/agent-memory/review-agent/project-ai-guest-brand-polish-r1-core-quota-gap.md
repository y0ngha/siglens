---
name: project-ai-guest-brand-polish-r1-core-quota-gap
description: feat/ai-guest-brand-polish R1 — guest chat is fully non-functional against currently-pinned core@1.2.1 (AGENT_LIMITS.turnsPerDay.free=0); everything else (font consolidation, LocaleLink hrefBase, session-cookie clear, tool guest-gating, i18n) verified clean
metadata:
  type: project
---

Scope: `feat/ai-guest-brand-polish` (builds on [[project-ai-beta-polish-r1]] /
[[project-agent-chat-release-final-integration]]). 6-part change: shared `fontVariables.ts`
(fixes ai-host `font-mono` fallback bug), logo→siglens.io on ai host via existing `hrefBase`,
`currentUserAction` stale-cookie clear, sessionless guest turns (`guestSubject.ts` =
`guest:` + `hashClientIp`), brand-wording sweep (`SIGLENS`/`SIGLENS AI` uppercase).

**1 required finding (verified live, not just source-read)**: the installed core package is
pinned at `1.2.1` (`package.json` + `yarn.lock` both confirm — no stale node_modules). In that
version's shipped `dist/application/agent/limits.js`, `AGENT_LIMITS.turnsPerDay = { free: 0,
member: 60, pro: 200 }`. `route.ts` sets guest `tier: Tier = 'free'` unconditionally (no guard,
no feature flag). `runAgentTurn.js`'s `counters.turns.consume(userId, agentLimit(tier,
'turnsPerDay'))` does `redis.incr` then `count(1) > limit(0)` → **every single guest turn fails
with `turn_limit` on the very first message**, before the model is ever called. This isn't
theoretical: `.env.e2e` configures a real local Upstash instance, so the branch's own new E2E
test (`agent-chat.spec.ts` guest-send case expecting `[E2E agent]` to render) will fail against
the currently pinned core, not just in a hypothetical future deploy. Compounding it, the new
copy `errorTurnLimitGuest` = "Guests can ask up to 10 questions a day. Log in to keep going." —
"10" comes from the *unreleased* `siglens-core` PR #200 (`turnsPerDay.free: 10` +
`login_required` for guest metered tools), which the branch's own context explicitly says
"not yet released... this siglens branch will bump core after release." There is no version
guard, feature flag, or `AGENT_CHAT_DISABLED`-style kill switch scoped to guests only — the
whole guest feature (the PR's headline capability) ships broken until an out-of-band core
publish + `yarn up` lands. Flagged as required because merging/deploying this branch before
that coordinated bump makes every guest interaction show a misleading "reached today's limit,
log in" message on message #1.

**Everything else verified correct**:
- `src/app/fontVariables.ts` (new, shared by both root layouts) — single `next/font/local`
  loader keeps `PretendardVariable-subset.woff2` (in `src/app/fonts/`, relative-path-correct
  from both `[locale]/layout.tsx` and `ai/[locale]/layout.tsx`) from being dual-served; adds
  `Geist_Mono` to the ai layout, which is the actual root cause fix for the reported font-mismatch
  bug (`font-mono` on the AI wordmark previously had no `--font-geist-mono` var on that host).
- `LocaleLink`/`useHrefBase`/`AiNavLink`/`LogoLockup`: `hrefBase` mechanism pre-existed
  (`LocaleContext.tsx`) — this branch just wires `AiRootLayout`'s `LocaleProvider hrefBase={SITE_URL}`
  and flips `LogoLockup`'s `Link href="/"` to go through it, so on ai host the logo becomes an
  absolute `https://siglens.io/...` URL while the `AI` half stays a same-origin plain `<a>` to
  the ai home. Read `LocaleLink.test.tsx` + `LogoLockup.tsx` + `AiNavLink.tsx` end to end,
  matches spec exactly.
- `currentUserAction.ts`: clears session+hint cookies ONLY when `getCurrentUser()` resolves
  (not rejects) to `null` and a cookie exists — try/catch correctly distinguishes "DB says no"
  from "DB unreachable" (doesn't log out on transient errors). 4/4 test cases map 1:1 to spec.
- `guestSubject.ts`: `guest:` + `hashClientIp(clientIp)` (core-exported, confirmed exists in
  `dist/index.d.ts`) — raw IP never reaches Redis keys, logs, or the `userId: subject` field in
  `console.info('[Agent]', ...)`. Route test explicitly asserts
  `expect(params.userId).not.toContain('203.0.113.7')`.
- Tool executor (`tools/index.ts`): `MEMBER_ONLY_TOOLS` (`get_my_portfolio`, `run_fresh_analysis`,
  `web_search`) refused with `{error:'login_required'}` for `isGuestSubject(ctx.userId)` BEFORE
  the executor runs — enforced locally regardless of what core's own tier gating does, so this
  part is NOT blocked on the core bump. `getCachedAnalysisTool` skips the holdings/position-bucket
  lookup for guest subjects (guest subject isn't a UUID the holdings table could match anyway).
- i18n: full 4-locale (ko/en/ja/zh) key-parity script — 0 missing/extra keys. Spot-checked new
  `errorTurnLimitGuest`/`guestNote`/`guestNotice` strings render distinct, real translations
  (not ko-copied placeholders) in en/ja/zh.
- Brand-wording sweep: `Footer.tsx`'s `aboutTitle(tSeo).replace(SITE_NAME, SITE_NAME.toUpperCase())`
  verified safe — `SITE_NAME = 'Siglens'` appears verbatim (case-sensitive exact match) in all 4
  locales' `about.title` string, so the `.replace()` never silently no-ops. Footer/AiNavLink/OG
  test files all updated in lockstep with the `.toUpperCase()`/literal changes (not stale).
- FSD/layers clean: new files (`fontVariables.ts` under `app/`, `guestSubject.ts` under
  `app/api/ai/chat/`) both correctly scoped; core import in `guestSubject.ts` allowed at any layer
  per CLAUDE.md.

Key lesson for future rounds on this epic: when a branch's own PR description says "core PR
not yet released, will bump after," always verify the *currently installed* core version's
actual runtime values for whatever the new client-side code assumes (quotas, error codes,
copy numbers) — don't take "will bump later" as a reason to skip checking today's behavior.
Here the gap was independently confirmed three ways (core dist source, own new E2E test's
expected outcome, and the literal "10" in new UI copy vs the installed "0").
