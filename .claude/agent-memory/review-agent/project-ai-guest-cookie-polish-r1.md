---
name: project-ai-guest-cookie-polish-r1
description: feat/ai-guest-cookie-polish R1 — core bumped to 1.3.1 (turnsPerDay.free=10, resolving prior R1 core-quota gap); cookie-based guest identity + per-IP backstops both verified sound, zero findings
metadata:
  type: project
---

Follow-up to [[project-ai-guest-brand-polish-r1-core-quota-gap]]: that round's blocking gap
(core pinned at 1.2.1 with `turnsPerDay.free=0`) is now resolved — `package.json`/`yarn.lock`
pin `1.3.1`, and `node_modules/@y0ngha/siglens-core/dist/application/agent/limits.js` confirms
`turnsPerDay: { free: 10, member: 60, pro: 200 }` live. `guestTurnLimit.ts`'s `GUEST_TURNS_PER_DAY`/
`MEMBER_TURNS_PER_DAY` literals + drift test (`agentLimit('free'|'member', 'turnsPerDay')`) both
match.

**Guest identity migration (IP → cookie) verified end-to-end, zero findings**:
- `shared/api/guestId.ts`: UUID-validated `siglens_guest` httpOnly cookie, mirrors
  `getClientIp.ts`'s `server-only` pattern; not imported by any `'use client'` file (grepped).
- `guestSubject.ts` → `guest:<uuid>` (no hash) as core's `userId`; `chatAction.ts`/
  `getRemainingTokensAction.ts` use `user:<id>` / `guest:<uuid>` as `clientKey`, hashed via
  `hashClientIp` before Redis (verified core's `requestChatCompletion.js` hashes it again
  internally via `tokenStore_1.hashClientIp` — same function, so both actions read/write the
  same bucket; test-verified with `hashed_guest:<uuid>` assertions).
- Per-IP backstops both fail-closed, tested for consume/outage/member-skip branches:
  agent `GUEST_IP_TURNS_PER_DAY=100` (`counters.ts`), chatbot `10 × TIER_CONFIG.limits.chatbotPerDay.free`
  (`chatAction.ts`). `route.test.ts` explicitly asserts `params.userId).not.toContain('203.0.113.7')`
  (no raw IP reaches core/logs) and that two guests behind one IP get distinct subjects.
- `route.ts` bot-check (`isBot`) runs before `getOrCreateGuestId()` is ever called — bots never
  mint a cookie. `chatAction.ts` has no equivalent bot-check, but confirmed via
  `git show origin/master:...chatAction.ts` this gap pre-dates this PR (not a regression, not
  introduced by the clientKey change) — not flagged.
- Note (not flagged, cross-repo): core's `recordChatUsageSafely` persists `clientIp` into a DB
  column literally named `ipAddress` — now receives `guest:<uuid>`/`user:<id>` instead of a raw
  IP. This is a privacy improvement (no raw IP persisted) but the column name is now misleading;
  out of scope for siglens (core-side schema), and explicitly acknowledged in `chatAction.ts`'s
  own JSDoc ("historical field name").

**Other changed areas, all clean**: `remarkGfm({ singleTilde: false })` fix math-verified against
the GFM spec; `AgentMarkdown`'s link/image sanitization already covered by tests, untouched by
this diff. `AiLanding.tsx`/`EmptyState.tsx`: all h2 use `HEADING_SECTION` token consistently (no
20.5-class drift), `<details>/<summary>` keyboard-accessible with focus ring, FAQ numbers
(`{guest}`/`{member}`) interpolate from the same drift-tested constants. i18n: all 4 locales
(ko/en/ja/zh) have identical `widgets.agent-chat.Landing.*` key sets (script-verified), distinct
real translations (not ko-copies) for the new no-brand Samsung suggestion. `useSymbolLabels.ts`
correctly imports the `actions.ts` barrel exception (widgets → entities/actions allowed by
CLAUDE.md). `useAgentStream.ts`'s draft-redraft logic (`DRAFT_MIN_CHARS=120`) has a falsifiable
boundary test with an exact-length fixture, and `MessageList.tsx`'s render ternary prioritizes
live `content` over `draft` so a new answer's first token immediately clears the redraft note
even though the `draft` field itself isn't cleared until the `done` event.

No new patterns for MISTAKES.md this round.
